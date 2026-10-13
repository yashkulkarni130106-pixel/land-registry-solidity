// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LandRegistry {
    address public registrar;

    struct Property {
        string propertyId;
        string location;
        uint256 area;           // in sq ft
        address currentOwner;
        bool exists;
    }

    struct Transfer {
        address from;
        address to;
        uint256 price;          // 0 for first registration
        uint256 timestamp;
    }

    mapping(string => Property) private properties;
    mapping(string => Transfer[]) private history;
    string[] private propertyIds;

    event PropertyRegistered(string propertyId, address indexed owner, uint256 timestamp);
    event OwnershipTransferred(
        string propertyId,
        address indexed from,
        address indexed to,
        uint256 price,
        uint256 timestamp
    );

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "Only registrar");
        _;
    }

    constructor() {
        registrar = msg.sender;
    }

    function registerProperty(
        string memory _id,
        string memory _location,
        uint256 _area,
        address _owner
    ) public onlyRegistrar {
        require(!properties[_id].exists, "Property already exists");
        require(_owner != address(0), "Invalid owner");

        properties[_id] = Property(_id, _location, _area, _owner, true);
        propertyIds.push(_id);
        history[_id].push(Transfer(address(0), _owner, 0, block.timestamp));

        emit PropertyRegistered(_id, _owner, block.timestamp);
    }

    function transferOwnership(
        string memory _id,
        address _newOwner,
        uint256 _price
    ) public {
        Property storage p = properties[_id];
        require(p.exists, "Property not found");
        require(msg.sender == p.currentOwner, "Only current owner can transfer");
        require(_newOwner != address(0) && _newOwner != msg.sender, "Invalid new owner");
        require(_price > 0, "Invalid price");

        history[_id].push(Transfer(msg.sender, _newOwner, _price, block.timestamp));
        p.currentOwner = _newOwner;

        emit OwnershipTransferred(_id, msg.sender, _newOwner, _price, block.timestamp);
    }

    function getProperty(string memory _id)
        public
        view
        returns (string memory location, uint256 area, address currentOwner)
    {
        Property storage p = properties[_id];
        require(p.exists, "Property not found");
        return (p.location, p.area, p.currentOwner);
    }

    function getHistory(string memory _id) public view returns (Transfer[] memory) {
        require(properties[_id].exists, "Property not found");
        return history[_id];
    }

    function totalProperties() public view returns (uint256) {
        return propertyIds.length;
    }

    function getAllPropertyIds() public view returns (string[] memory) {
        return propertyIds;
    }
}
