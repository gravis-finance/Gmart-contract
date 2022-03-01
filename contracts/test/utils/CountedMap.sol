// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

// Reference counted mapping[address => uint].
library CountedMap {
    uint256 constant COUNTER_MASK = (1 << 128) - 1;

    struct Map {
        // Maps addresses to pair (index, counter) represented as single uint256.
        mapping(address => uint256) dict;
        address[] data;
    }

    function add(
        Map storage _map,
        address _who,
        uint256 _cnt
    ) internal {
        uint256 value = _map.dict[_who];
        if (value == 0) {
            _map.data.push(_who);
            require(_cnt > 0 && _cnt <= COUNTER_MASK, 'CountedMap: overflow');
            _map.dict[_who] = (_map.data.length << 128) + (_cnt - 1);
        } else {
            uint256 newVal = value + _cnt;
            require((newVal > value) && ((value & COUNTER_MASK) + _cnt < COUNTER_MASK), 'CountedMap: overflow');
            _map.dict[_who] = newVal;
        }
    }

    function remove(
        Map storage _map,
        address _who,
        uint256 _cnt
    ) internal {
        uint256 value = _map.dict[_who];
        if (value == 0) {
            return;
        } else if ((value & COUNTER_MASK) < _cnt) {
            uint256 index = (value >> 128) - 1;
            uint256 last = _map.data.length - 1;
            address moved = _map.data[index] = _map.data[last];
            _map.dict[moved] = (_map.dict[moved] & COUNTER_MASK) | ((index + 1) << 128);
            _map.data.pop();
            delete _map.dict[_who];
        } else {
            _map.dict[_who] = value - _cnt;
        }
    }

    function length(Map storage _map) internal view returns (uint256) {
        return _map.data.length;
    }

    function at(Map storage _map, uint256 _index) internal view returns (address) {
        return _map.data[_index];
    }

    function counter(Map storage _map, address _addr) internal view returns (uint256) {
        uint256 value = _map.dict[_addr];
        if (value == 0) return 0;
        return (value & COUNTER_MASK) + 1;
    }
}
