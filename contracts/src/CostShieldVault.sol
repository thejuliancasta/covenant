// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title CostShieldVault
/// @notice Fully collateralised price-cap vault for the CostShield prototype.
///         TESTNET SIMULATION ONLY. Not insurance, not an offer of derivatives.
///
/// Economic design
///  - An underwriter deposits USDC collateral.
///  - The owner opens a policy for a known beneficiary. Opening reserves the
///    policy's full aggregate limit out of free collateral, so a policy can
///    never exist without the money to pay it.
///  - Each period (a calendar month, YYYYMM) the oracle attests the index mean
///    and the verified quantity purchased. The contract, not the oracle,
///    computes the payout:
///        payout = max(0, index - strike) * min(quantity, maxQuantity)
///    capped by the remaining aggregate limit, and pays the beneficiary.
///  - A period can settle once. Unknown callers, out-of-term periods,
///    implausible index values and repeat settlements all revert.
///
/// Trust assumptions (disclosed in the README): the oracle is a single
/// authorised key that replays public EIA history, and the owner is a single
/// key. Units: prices are micro-USD per unit (6 decimals, same as USDC);
/// quantities are milli-units (3 decimals).
contract CostShieldVault {
    struct Policy {
        address beneficiary;
        bytes32 indexId; // e.g. keccak256("EIA:EMD_EPD2D_PTE_R20_DPG:monthly-mean")
        uint64 strike; // micro-USD per unit
        uint64 maxIndex; // sanity bound on attested index, micro-USD per unit
        uint64 maxQuantityMilli; // per-period quantity cap, milli-units
        uint32 firstPeriod; // YYYYMM
        uint32 lastPeriod; // YYYYMM
        uint128 remainingLimit; // USDC still reserved for this policy
        uint128 paid; // USDC paid so far
        bool open;
    }

    IERC20 public immutable usdc;
    address public owner;
    address public oracle;
    uint256 public reserved; // USDC reserved across all open policies
    uint256 public nextPolicyId = 1;

    mapping(uint256 => Policy) public policies;
    mapping(uint256 => mapping(uint32 => bool)) public settled;

    event CollateralDeposited(address indexed from, uint256 amount);
    event CollateralWithdrawn(address indexed to, uint256 amount);
    event OracleChanged(address indexed oracle);
    event PolicyOpened(uint256 indexed policyId, address indexed beneficiary, bytes32 indexId, uint64 strike, uint64 maxQuantityMilli, uint32 firstPeriod, uint32 lastPeriod, uint128 aggregateLimit);
    event PeriodSettled(uint256 indexed policyId, uint32 indexed period, uint64 indexPrice, uint64 quantityMilli, uint256 payout, address indexed beneficiary);
    event PolicyClosed(uint256 indexed policyId, uint256 released);

    error NotOwner();
    error NotOracle();
    error ZeroAddress();
    error ZeroAmount();
    error BadTerms();
    error InsufficientCollateral(uint256 free, uint256 needed);
    error PolicyNotOpen(uint256 policyId);
    error PeriodOutOfTerm(uint32 period);
    error AlreadySettled(uint256 policyId, uint32 period);
    error IndexOutOfBounds(uint64 indexPrice, uint64 maxIndex);
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 usdc_, address oracle_) {
        if (address(usdc_) == address(0) || oracle_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        owner = msg.sender;
        oracle = oracle_;
        emit OracleChanged(oracle_);
    }

    /// @notice USDC in the vault that is not reserved for an open policy.
    function freeCollateral() public view returns (uint256) {
        return usdc.balanceOf(address(this)) - reserved;
    }

    /// @notice Anyone may add collateral. Requires prior USDC approval.
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Owner may withdraw free collateral only. Reserved funds cannot leave.
    function withdraw(address to, uint256 amount) external onlyOwner {
        uint256 free = freeCollateral();
        if (amount > free) revert InsufficientCollateral(free, amount);
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit CollateralWithdrawn(to, amount);
    }

    function setOracle(address oracle_) external onlyOwner {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleChanged(oracle_);
    }

    /// @notice Opens a policy and reserves its full aggregate limit.
    function openPolicy(
        address beneficiary,
        bytes32 indexId,
        uint64 strike,
        uint64 maxIndex,
        uint64 maxQuantityMilli,
        uint32 firstPeriod,
        uint32 lastPeriod,
        uint128 aggregateLimit
    ) external onlyOwner returns (uint256 policyId) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (strike == 0 || maxIndex <= strike || maxQuantityMilli == 0 || aggregateLimit == 0 || lastPeriod < firstPeriod) revert BadTerms();
        uint256 free = freeCollateral();
        if (aggregateLimit > free) revert InsufficientCollateral(free, aggregateLimit);
        policyId = nextPolicyId++;
        reserved += aggregateLimit;
        policies[policyId] = Policy(beneficiary, indexId, strike, maxIndex, maxQuantityMilli, firstPeriod, lastPeriod, aggregateLimit, 0, true);
        emit PolicyOpened(policyId, beneficiary, indexId, strike, maxQuantityMilli, firstPeriod, lastPeriod, aggregateLimit);
    }

    /// @notice Payout for an attested index and quantity, before the aggregate limit is applied.
    function quote(uint256 policyId, uint64 indexPrice, uint64 quantityMilli) public view returns (uint256) {
        Policy storage p = policies[policyId];
        if (indexPrice <= p.strike) return 0;
        uint256 qty = quantityMilli > p.maxQuantityMilli ? p.maxQuantityMilli : quantityMilli;
        return (uint256(indexPrice - p.strike) * qty) / 1000;
    }

    /// @notice Oracle attests one period. The contract computes and pays the payout.
    ///         A period below the strike settles with a zero payout and cannot be re-opened.
    function settle(uint256 policyId, uint32 period, uint64 indexPrice, uint64 quantityMilli) external returns (uint256 payout) {
        if (msg.sender != oracle) revert NotOracle();
        Policy storage p = policies[policyId];
        if (!p.open) revert PolicyNotOpen(policyId);
        if (period < p.firstPeriod || period > p.lastPeriod) revert PeriodOutOfTerm(period);
        if (settled[policyId][period]) revert AlreadySettled(policyId, period);
        if (indexPrice == 0 || indexPrice > p.maxIndex) revert IndexOutOfBounds(indexPrice, p.maxIndex);

        payout = quote(policyId, indexPrice, quantityMilli);
        if (payout > p.remainingLimit) payout = p.remainingLimit;

        settled[policyId][period] = true;
        if (payout > 0) {
            p.remainingLimit -= uint128(payout);
            p.paid += uint128(payout);
            reserved -= payout;
            if (!usdc.transfer(p.beneficiary, payout)) revert TransferFailed();
        }
        emit PeriodSettled(policyId, period, indexPrice, quantityMilli, payout, p.beneficiary);
    }

    /// @notice Owner closes a policy and releases whatever limit is left back to free collateral.
    function closePolicy(uint256 policyId) external onlyOwner {
        Policy storage p = policies[policyId];
        if (!p.open) revert PolicyNotOpen(policyId);
        uint256 released = p.remainingLimit;
        p.open = false;
        p.remainingLimit = 0;
        reserved -= released;
        emit PolicyClosed(policyId, released);
    }
}
