//! Read-only native USB bulk endpoint preflight. Never claims an interface or sends a transfer.
//! Descriptor evidence is not protocol authentication or permission to write firmware.
use crate::transport::EndpointRecord;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BulkPair {
    pub configuration: u8,
    pub interface: u8,
    pub alternate_setting: u8,
    pub in_address: u8,
    pub out_address: u8,
    pub in_max_packet_size: u16,
    pub out_max_packet_size: u16,
}

pub fn candidate_bulk_pairs(endpoints: &[EndpointRecord]) -> Vec<BulkPair> {
    let mut pairs = Vec::new();
    for input in endpoints.iter().filter(|e| {
        e.transfer_type == "bulk" && e.direction == "in" &&
        e.address & 0x80 != 0 && e.max_packet_size > 0
    }) {
        for output in endpoints.iter().filter(|e| {
            e.transfer_type == "bulk" && e.direction == "out" &&
            e.address & 0x80 == 0 && e.max_packet_size > 0 &&
            e.configuration == input.configuration &&
            e.interface == input.interface &&
            e.alternate_setting == input.alternate_setting
        }) {
            pairs.push(BulkPair {
                configuration: input.configuration,
                interface: input.interface,
                alternate_setting: input.alternate_setting,
                in_address: input.address,
                out_address: output.address,
                in_max_packet_size: input.max_packet_size,
                out_max_packet_size: output.max_packet_size,
            });
        }
    }
    pairs.sort_by_key(|p| (p.configuration, p.interface, p.alternate_setting, p.in_address, p.out_address));
    pairs.dedup();
    pairs
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ep(interface: u8, alternate: u8, address: u8, direction: &str, kind: &str) -> EndpointRecord {
        EndpointRecord {
            configuration: 1, interface, alternate_setting: alternate, address,
            direction: direction.into(), transfer_type: kind.into(),
            max_packet_size: 512, interval: 0, interface_class: 6, interface_subclass: 1, interface_protocol: 1,
        }
    }

    #[test]
    fn finds_matching_bulk_pair_without_io() {
        let endpoints = [ep(1, 0, 0x81, "in", "bulk"), ep(1, 0, 0x02, "out", "bulk")];
        let pairs = candidate_bulk_pairs(&endpoints);
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].in_address, 0x81);
        assert_eq!(pairs[0].out_address, 0x02);
    }

    #[test]
    fn never_pairs_different_interfaces_or_alternates() {
        let endpoints = [ep(1, 0, 0x81, "in", "bulk"), ep(2, 0, 0x02, "out", "bulk"),
                         ep(1, 1, 0x03, "out", "bulk")];
        assert!(candidate_bulk_pairs(&endpoints).is_empty());
    }

    #[test]
    fn ignores_control_and_invalid_endpoint_direction() {
        let endpoints = [ep(1, 0, 0x81, "in", "bulk"), ep(1, 0, 0x02, "out", "control"),
                         ep(1, 0, 0x83, "out", "bulk")];
        assert!(candidate_bulk_pairs(&endpoints).is_empty());
    }
}
