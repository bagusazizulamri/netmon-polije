package main

import (
	"time"

	"github.com/polije/netmon/internal/model"
	"github.com/polije/netmon/internal/store"
)

func seedIfEmpty(s *store.Store) error {
	existing, err := s.ListDevices()
	if err != nil {
		return err
	}
	if len(existing) > 0 {
		return nil
	}
	now := time.Now().UTC()
	seed := []model.Device{
		{Hostname: "pve-dc-polije-01", IP: "10.10.1.10", Category: model.CatServer, Vendor: "Dell", Model: "PowerEdge R750",
			BuildingID: "tik", Floor: "Rack A1", Status: model.StatusOnline, CPU: 31, Mem: 58, Temp: 44, LatencyMs: 0.42,
			TrafficInMbps: 412, TrafficOutMbps: 388, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 42, LastSeen: now},
		{Hostname: "pve-dc-polije-02", IP: "10.10.1.11", Category: model.CatServer, Vendor: "Dell", Model: "PowerEdge R750",
			BuildingID: "tik", Floor: "Rack A2", Status: model.StatusOnline, CPU: 27, Mem: 52, Temp: 46, LatencyMs: 0.39,
			TrafficInMbps: 221, TrafficOutMbps: 198, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 39, LastSeen: now},
		{Hostname: "cr-mk-polije-core-01", IP: "10.10.0.1", Category: model.CatRouter, Vendor: "MikroTik", Model: "CCR2116-12G-4S+",
			BuildingID: "tik", Floor: "MDF", Status: model.StatusOnline, CPU: 24, Mem: 39, Temp: 48, LatencyMs: 0.54,
			TrafficInMbps: 1832, TrafficOutMbps: 1710, SNMP: true, SNMPCommunity: "publicPolije", Site: "main", Source: "seed",
			UptimeSec: 86400 * 87, LastSeen: now},
		{Hostname: "cr-mk-polije-core-02", IP: "10.10.0.2", Category: model.CatRouter, Vendor: "MikroTik", Model: "CCR2116-12G-4S+",
			BuildingID: "tik", Floor: "MDF", Status: model.StatusOnline, CPU: 21, Mem: 36, Temp: 46, LatencyMs: 0.61,
			TrafficInMbps: 910, TrafficOutMbps: 846, SNMP: true, SNMPCommunity: "publicPolije", Site: "main", Source: "seed",
			UptimeSec: 86400 * 85, LastSeen: now},
		{Hostname: "sw-aruba-tip-01", IP: "10.10.10.2", Category: model.CatSwitch, Vendor: "Aruba", Model: "CX 6300M",
			BuildingID: "tip", Floor: "Lt1", Status: model.StatusOnline, CPU: 18, Mem: 36, Temp: 43, LatencyMs: 0.72,
			TrafficInMbps: 640, TrafficOutMbps: 602, PoEW: 311, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 44, LastSeen: now},
		{Hostname: "sw-aruba-tip-02", IP: "10.10.10.3", Category: model.CatSwitch, Vendor: "Aruba", Model: "2930F 48P",
			BuildingID: "tip", Floor: "Lt2", Status: model.StatusOnline, CPU: 12, Mem: 29, Temp: 41, LatencyMs: 0.86,
			TrafficInMbps: 210, TrafficOutMbps: 196, PoEW: 184, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 38, LastSeen: now},
		{Hostname: "sw-rj-mif-01", IP: "10.10.12.2", Category: model.CatSwitch, Vendor: "Ruijie", Model: "RG-S5750-48GT",
			BuildingID: "mif", Floor: "Lt1", Status: model.StatusOnline, CPU: 22, Mem: 33, Temp: 45, LatencyMs: 1.02,
			TrafficInMbps: 420, TrafficOutMbps: 395, SNMP: true, SNMPCommunity: "ruijieRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 31, LastSeen: now},
		{Hostname: "sw-uf-tik-01", IP: "10.10.1.5", Category: model.CatSwitch, Vendor: "UniFi", Model: "USW-Pro-48-PoE",
			BuildingID: "tik", Floor: "Rack A", Status: model.StatusOnline, CPU: 9, Mem: 24, Temp: 40, LatencyMs: 0.44,
			TrafficInMbps: 520, TrafficOutMbps: 498, PoEW: 278, SNMP: true, SNMPCommunity: "unifiRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 55, LastSeen: now},
		{Hostname: "sw-jn-rek-01", IP: "10.10.0.10", Category: model.CatSwitch, Vendor: "Juniper", Model: "EX4300-48P",
			BuildingID: "rektorat", Floor: "Lt1", Status: model.StatusOnline, CPU: 15, Mem: 31, Temp: 42, LatencyMs: 0.61,
			TrafficInMbps: 312, TrafficOutMbps: 288, PoEW: 142, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 72, LastSeen: now},
		{Hostname: "sw-aruba-gor-01", IP: "10.10.62.2", Category: model.CatSwitch, Vendor: "Aruba", Model: "2930F 24P",
			BuildingID: "gor", Floor: "Lt1", Status: model.StatusOffline, LatencyMs: 0, Loss: 100,
			SNMP: false, Site: "main", Source: "seed", Notes: "Listrik padam panel GOR", LastSeen: now.Add(-3600 * 2 * time.Second)},
		{Hostname: "ap-uf-tip-101", IP: "10.10.10.101", Category: model.CatAP, Vendor: "UniFi", Model: "U6-Pro",
			BuildingID: "tip", Floor: "Lt1-101", Status: model.StatusOnline, CPU: 14, Mem: 41, Temp: 46, LatencyMs: 1.6,
			TrafficInMbps: 42, TrafficOutMbps: 68, Clients: 41, SNMP: false, Site: "main", Source: "seed",
			UptimeSec: 86400 * 16, LastSeen: now},
		{Hostname: "ap-uf-tip-202", IP: "10.10.10.102", Category: model.CatAP, Vendor: "UniFi", Model: "U6-Pro",
			BuildingID: "tip", Floor: "Lt2-202", Status: model.StatusOnline, CPU: 12, Mem: 38, Temp: 44, LatencyMs: 1.7,
			TrafficInMbps: 31, TrafficOutMbps: 52, Clients: 33, SNMP: false, Site: "main", Source: "seed",
			UptimeSec: 86400 * 16, LastSeen: now},
		{Hostname: "ap-uf-mif-lobby", IP: "10.10.12.101", Category: model.CatAP, Vendor: "UniFi", Model: "U7-Pro",
			BuildingID: "mif", Floor: "Lobby", Status: model.StatusOnline, CPU: 16, Mem: 43, Temp: 47, LatencyMs: 1.4,
			TrafficInMbps: 48, TrafficOutMbps: 81, Clients: 56, SNMP: false, Site: "main", Source: "seed",
			UptimeSec: 86400 * 12, LastSeen: now},
		{Hostname: "ap-aruba-pus-01", IP: "10.10.60.101", Category: model.CatAP, Vendor: "Aruba", Model: "AP-515",
			BuildingID: "perpustakaan", Floor: "Lt1", Status: model.StatusOnline, CPU: 11, Mem: 36, Temp: 44, LatencyMs: 1.2,
			TrafficInMbps: 38, TrafficOutMbps: 61, Clients: 44, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 26, LastSeen: now},
		{Hostname: "ap-rj-tep-01", IP: "10.10.30.101", Category: model.CatAP, Vendor: "Ruijie", Model: "RG-RAP2260(G)",
			BuildingID: "tep", Floor: "Lt1", Status: model.StatusWarning, CPU: 54, Mem: 68, Temp: 58, LatencyMs: 3.8, Loss: 0.9,
			TrafficInMbps: 22, TrafficOutMbps: 31, Clients: 18, SNMP: true, SNMPCommunity: "ruijieRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 3, Notes: "Channel util tinggi", LastSeen: now},
		{Hostname: "ap-uf-aula-01", IP: "10.10.61.101", Category: model.CatAP, Vendor: "UniFi", Model: "U6-LR",
			BuildingID: "aula", Floor: "Hall", Status: model.StatusOnline, CPU: 13, Mem: 39, Temp: 45, LatencyMs: 1.9,
			TrafficInMbps: 55, TrafficOutMbps: 74, Clients: 67, SNMP: false, Site: "main", Source: "seed",
			UptimeSec: 86400 * 9, LastSeen: now},
		{Hostname: "ap-aruba-rek-lobby", IP: "10.10.0.101", Category: model.CatAP, Vendor: "Aruba", Model: "AP-505H",
			BuildingID: "rektorat", Floor: "Lobby", Status: model.StatusOnline, CPU: 8, Mem: 29, Temp: 40, LatencyMs: 0.94,
			TrafficInMbps: 14, TrafficOutMbps: 21, Clients: 16, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 31, LastSeen: now},
		{Hostname: "sso-polije", IP: "10.10.1.41", Category: model.CatServer, Vendor: "HPE", Model: "DL20",
			BuildingID: "tik", Floor: "Rack D2", Status: model.StatusWarning, CPU: 66, Mem: 71, Temp: 52, LatencyMs: 1.84, Loss: 0.1,
			TrafficInMbps: 54, TrafficOutMbps: 49, SNMP: true, SNMPCommunity: "polijeRO", Site: "main", Source: "seed",
			UptimeSec: 86400 * 7, Notes: "High CPU LDAP sync", LastSeen: now},
	}
	for i := range seed {
		if err := s.UpsertDevice(&seed[i]); err != nil {
			return err
		}
	}
	return nil
}
