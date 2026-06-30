import { useEffect, useMemo, useState } from "react"
import {
  Activity, AlertTriangle, Antenna,
  Database, EthernetPort, LayoutDashboard,
  MapPinned, Network, RefreshCcw, Router, SearchCode,
  Server as ServerIcon, SquareTerminal, Waves,
  Wifi, Zap, CheckCircle2, Dot,
  Boxes, Signal, X, TerminalSquare, Download
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts"

type DeviceStatus = "online" | "warning" | "offline" | "maintenance"
type DeviceCategory = "server" | "router" | "switch" | "ap"
type VendorName = "MikroTik" | "Aruba" | "Ruijie" | "UniFi" | "Juniper" | "Dell" | "HPE" | "Supermicro"

interface Device {
  id: string
  hostname: string
  ip: string
  category: DeviceCategory
  vendor: VendorName
  model: string
  buildingId: string
  floor?: string
  status: DeviceStatus
  uptimeSec: number
  cpu: number
  mem: number
  temp: number
  latencyMs: number
  loss: number
  trafficInMbps: number
  trafficOutMbps: number
  clients?: number
  poeW?: number
  snmp: boolean
  snmpCommunity?: string
  site: "main" | "nganjuk" | "bondowoso" | "sidoarjo"
  lastSeen: string
  notes?: string
}

interface Building {
  id: string
  name: string
  short: string
  x: number
  y: number
  w: number
  h: number
  subnet: string
  vlan: number
  color: string
}

interface AlertItem {
  id: string
  time: string
  sev: "info" | "warn" | "crit"
  deviceId: string
  message: string
  ack: boolean
}

interface UniFiDiscovery {
  mac: string
  ip: string
  model: string
  adopted: boolean
  site: string
  clients: number
  version: string
}

const INITIAL_BUILDINGS: Building[] = [
  { id:"rektorat", name:"Gedung Utama / Rektorat", short:"REKT", x:500, y:120, w:210, h:78, subnet:"10.10.0.0/24", vlan:10, color:"#eaf1ff"},
  { id:"tip", name:"Jurusan Teknologi Informasi", short:"TIP", x:260, y:210, w:190, h:74, subnet:"10.10.10.0/24", vlan:110, color:"#eefbf3"},
  { id:"tik", name:"TIK / Data Center", short:"TIK", x:498, y:238, w:210, h:66, subnet:"10.10.1.0/24", vlan:1, color:"#fff6e9"},
  { id:"mif", name:"Gedung MIF", short:"MIF", x:736, y:208, w:170, h:68, subnet:"10.10.12.0/24", vlan:112, color:"#f1f5ff"},
  { id:"mesin", name:"Teknik Mesin", short:"MSN", x:120, y:312, w:164, h:62, subnet:"10.10.20.0/24", vlan:120, color:"#f9f2ff"},
  { id:"tep", name:"Teknologi Pertanian", short:"TEP", x:315, y:318, w:168, h:60, subnet:"10.10.30.0/24", vlan:130, color:"#f2fff5"},
  { id:"pet", name:"Peternakan", short:"PET", x:514, y:334, w:156, h:58, subnet:"10.10.40.0/24", vlan:140, color:"#fff7f2"},
  { id:"labterpadu", name:"Lab Terpadu", short:"LAB", x:704, y:312, w:190, h:60, subnet:"10.10.50.0/24", vlan:150, color:"#f5fbff"},
  { id:"perpustakaan", name:"Perpustakaan", short:"PUS", x:208, y:418, w:170, h:56, subnet:"10.10.60.0/24", vlan:160, color:"#f7f7ff"},
  { id:"aula", name:"Aula Soetrisno", short:"AULA", x:410, y:424, w:174, h:54, subnet:"10.10.61.0/24", vlan:161, color:"#fffaf0"},
  { id:"gor", name:"GOR Perjuangan 45", short:"GOR", x:620, y:419, w:214, h:58, subnet:"10.10.62.0/24", vlan:162, color:"#f2fbff"},
  { id:"asrama", name:"Asrama Mahasiswa", short:"ASR", x:156, y:512, w:198, h:52, subnet:"10.10.70.0/24", vlan:170, color:"#fef6ff"},
  { id:"kantin", name:"Kantin Pusat", short:"KTN", x:402, y:514, w:154, h:50, subnet:"10.10.71.0/24", vlan:171, color:"#f8fff3"},
  { id:"greenhouse", name:"Green House / Lab Lapang", short:"GH", x:634, y:508, w:216, h:52, subnet:"10.10.80.0/24", vlan:180, color:"#f1fff9"},
]

const INITIAL_DEVICES: Device[] = [
  // Servers di TIK / DC
  { id:"srv-pve01", hostname:"pve-dc-polije-01", ip:"10.10.1.10", category:"server", vendor:"Dell", model:"PowerEdge R750", buildingId:"tik", floor:"Rack A1", status:"online", uptimeSec:86400*42, cpu:31, mem:58, temp:44, latencyMs:0.42, loss:0, trafficInMbps:412, trafficOutMbps:388, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"srv-pve02", hostname:"pve-dc-polije-02", ip:"10.10.1.11", category:"server", vendor:"Dell", model:"PowerEdge R750", buildingId:"tik", floor:"Rack A2", status:"online", uptimeSec:86400*39, cpu:27, mem:52, temp:46, latencyMs:0.39, loss:0, trafficInMbps:221, trafficOutMbps:198, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"srv-nas", hostname:"nas-backup-polije", ip:"10.10.1.20", category:"server", vendor:"Supermicro", model:"SSG-640P", buildingId:"tik", floor:"Rack B1", status:"online", uptimeSec:86400*112, cpu:14, mem:44, temp:41, latencyMs:0.51, loss:0, trafficInMbps:96, trafficOutMbps:62, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"srv-radius", hostname:"radius-polije", ip:"10.10.1.30", category:"server", vendor:"HPE", model:"DL360 Gen11", buildingId:"tik", floor:"Rack C1", status:"online", uptimeSec:86400*18, cpu:8, mem:31, temp:39, latencyMs:0.33, loss:0, trafficInMbps:12, trafficOutMbps:14, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"srv-zabbix", hostname:"mon-zabbix-polije", ip:"10.10.1.35", category:"server", vendor:"Dell", model:"R440", buildingId:"tik", floor:"Rack C2", status:"online", uptimeSec:86400*54, cpu:22, mem:41, temp:42, latencyMs:0.36, loss:0, trafficInMbps:28, trafficOutMbps:31, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"srv-unifi", hostname:"unifi-ctrl-polije", ip:"10.10.1.40", category:"server", vendor:"Dell", model:"R340", buildingId:"tik", floor:"Rack D1", status:"online", uptimeSec:86400*29, cpu:19, mem:36, temp:40, latencyMs:0.29, loss:0, trafficInMbps:18, trafficOutMbps:20, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"srv-sso", hostname:"sso-polije", ip:"10.10.1.41", category:"server", vendor:"HPE", model:"DL20", buildingId:"tik", floor:"Rack D2", status:"warning", uptimeSec:86400*7, cpu:66, mem:71, temp:52, latencyMs:1.84, loss:0.1, trafficInMbps:54, trafficOutMbps:49, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString(), notes:"High CPU LDAP sync" },

  // Routers MikroTik core / dist
  { id:"rt-core-01", hostname:"cr-mk-polije-core-01", ip:"10.10.0.1", category:"router", vendor:"MikroTik", model:"CCR2116-12G-4S+", buildingId:"tik", floor:"MDF", status:"online", uptimeSec:86400*87, cpu:24, mem:39, temp:48, latencyMs:0.54, loss:0, trafficInMbps:1832, trafficOutMbps:1710, snmp:true, snmpCommunity:"publicPolije", site:"main", lastSeen: new Date().toISOString() },
  { id:"rt-core-02", hostname:"cr-mk-polije-core-02", ip:"10.10.0.2", category:"router", vendor:"MikroTik", model:"CCR2116-12G-4S+", buildingId:"tik", floor:"MDF", status:"online", uptimeSec:86400*85, cpu:21, mem:36, temp:46, latencyMs:0.61, loss:0, trafficInMbps:910, trafficOutMbps:846, snmp:true, snmpCommunity:"publicPolije", site:"main", lastSeen: new Date().toISOString() },
  { id:"rt-edge-01", hostname:"gw-mk-edge-01", ip:"202.58.xx.1", category:"router", vendor:"MikroTik", model:"CCR2004", buildingId:"rektorat", floor:"Lt2", status:"online", uptimeSec:86400*64, cpu:38, mem:44, temp:51, latencyMs:2.1, loss:0, trafficInMbps:1342, trafficOutMbps:1248, snmp:true, snmpCommunity:"publicPolije", site:"main", lastSeen: new Date().toISOString() },
  { id:"rt-nganjuk", hostname:"rt-mk-nganjuk", ip:"10.20.0.1", category:"router", vendor:"MikroTik", model:"RB5009", buildingId:"rektorat", floor:"Lt1", status:"online", uptimeSec:86400*21, cpu:16, mem:29, temp:44, latencyMs:12.8, loss:0.2, trafficInMbps:188, trafficOutMbps:172, snmp:true, snmpCommunity:"publicPolije", site:"nganjuk", lastSeen: new Date().toISOString() },

  // Switches
  { id:"sw-aruba-tip-core", hostname:"sw-aruba-tip-01", ip:"10.10.10.2", category:"switch", vendor:"Aruba", model:"CX 6300M", buildingId:"tip", floor:"Lt1", status:"online", uptimeSec:86400*44, cpu:18, mem:36, temp:43, latencyMs:0.72, loss:0, trafficInMbps:640, trafficOutMbps:602, poeW:311, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-aruba-tip-2", hostname:"sw-aruba-tip-02", ip:"10.10.10.3", category:"switch", vendor:"Aruba", model:"Aruba 2930F 48P", buildingId:"tip", floor:"Lt2", status:"online", uptimeSec:86400*38, cpu:12, mem:29, temp:41, latencyMs:0.86, loss:0, trafficInMbps:210, trafficOutMbps:196, poeW:184, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-ruijie-mif", hostname:"sw-rj-mif-01", ip:"10.10.12.2", category:"switch", vendor:"Ruijie", model:"RG-S5750-48GT", buildingId:"mif", floor:"Lt1", status:"online", uptimeSec:86400*31, cpu:22, mem:33, temp:45, latencyMs:1.02, loss:0, trafficInMbps:420, trafficOutMbps:395, poeW:0, snmp:true, snmpCommunity:"ruijieRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-unifi-tik", hostname:"sw-uf-tik-01", ip:"10.10.1.5", category:"switch", vendor:"UniFi", model:"USW-Pro-48-PoE", buildingId:"tik", floor:"Rack A", status:"online", uptimeSec:86400*55, cpu:9, mem:24, temp:40, latencyMs:0.44, loss:0, trafficInMbps:520, trafficOutMbps:498, poeW:278, snmp:true, snmpCommunity:"unifiRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-juniper-rektorat", hostname:"sw-jn-rek-01", ip:"10.10.0.10", category:"switch", vendor:"Juniper", model:"EX4300-48P", buildingId:"rektorat", floor:"Lt1", status:"online", uptimeSec:86400*72, cpu:15, mem:31, temp:42, latencyMs:0.61, loss:0, trafficInMbps:312, trafficOutMbps:288, poeW:142, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-ruijie-tep", hostname:"sw-rj-tep-01", ip:"10.10.30.2", category:"switch", vendor:"Ruijie", model:"RG-S2910-24GT4SFP", buildingId:"tep", floor:"Lt1", status:"warning", uptimeSec:86400*5, cpu:57, mem:61, temp:53, latencyMs:2.44, loss:0.3, trafficInMbps:164, trafficOutMbps:149, poeW:88, snmp:true, snmpCommunity:"ruijieRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-aruba-mesin", hostname:"sw-aruba-mesin-01", ip:"10.10.20.2", category:"switch", vendor:"Aruba", model:"Aruba 2530-48G", buildingId:"mesin", floor:"Lt1", status:"online", uptimeSec:86400*40, cpu:11, mem:27, temp:39, latencyMs:1.18, loss:0, trafficInMbps:132, trafficOutMbps:118, poeW:76, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-unifi-perpus", hostname:"sw-uf-perpus-01", ip:"10.10.60.2", category:"switch", vendor:"UniFi", model:"USW-24-PoE", buildingId:"perpustakaan", floor:"Lt1", status:"online", uptimeSec:86400*29, cpu:7, mem:22, temp:38, latencyMs:1.02, loss:0, trafficInMbps:98, trafficOutMbps:84, poeW:62, snmp:true, snmpCommunity:"unifiRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-ruijie-lab", hostname:"sw-rj-lab-01", ip:"10.10.50.2", category:"switch", vendor:"Ruijie", model:"RG-S5750E-28GT", buildingId:"labterpadu", floor:"Lt1", status:"online", uptimeSec:86400*23, cpu:19, mem:34, temp:44, latencyMs:1.31, loss:0, trafficInMbps:244, trafficOutMbps:221, poeW:104, snmp:true, snmpCommunity:"ruijieRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-aruba-gor", hostname:"sw-aruba-gor-01", ip:"10.10.62.2", category:"switch", vendor:"Aruba", model:"Aruba 2930F 24P", buildingId:"gor", floor:"Lt1", status:"offline", uptimeSec:0, cpu:0, mem:0, temp:0, latencyMs:0, loss:100, trafficInMbps:0, trafficOutMbps:0, poeW:0, snmp:false, site:"main", lastSeen: new Date(Date.now()-3600*2000).toISOString(), notes:"Listrik padam panel GOR" },

  // Access Points
  { id:"ap-uf-tip-101", hostname:"ap-uf-tip-101", ip:"10.10.10.101", category:"ap", vendor:"UniFi", model:"U6-Pro", buildingId:"tip", floor:"Lt1-101", status:"online", uptimeSec:86400*16, cpu:14, mem:41, temp:46, latencyMs:1.6, loss:0, trafficInMbps:42, trafficOutMbps:68, clients:41, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-tip-202", hostname:"ap-uf-tip-202", ip:"10.10.10.102", category:"ap", vendor:"UniFi", model:"U6-Pro", buildingId:"tip", floor:"Lt2-202", status:"online", uptimeSec:86400*16, cpu:12, mem:38, temp:44, latencyMs:1.7, loss:0, trafficInMbps:31, trafficOutMbps:52, clients:33, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-mif-1", hostname:"ap-uf-mif-lobby", ip:"10.10.12.101", category:"ap", vendor:"UniFi", model:"U7-Pro", buildingId:"mif", floor:"Lobby", status:"online", uptimeSec:86400*12, cpu:16, mem:43, temp:47, latencyMs:1.4, loss:0, trafficInMbps:48, trafficOutMbps:81, clients:56, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-aruba-perpus", hostname:"ap-aruba-pus-01", ip:"10.10.60.101", category:"ap", vendor:"Aruba", model:"AP-515", buildingId:"perpustakaan", floor:"Lt1", status:"online", uptimeSec:86400*26, cpu:11, mem:36, temp:44, latencyMs:1.2, loss:0, trafficInMbps:38, trafficOutMbps:61, clients:44, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-aruba-perpus-2", hostname:"ap-aruba-pus-02", ip:"10.10.60.102", category:"ap", vendor:"Aruba", model:"AP-515", buildingId:"perpustakaan", floor:"Lt2", status:"online", uptimeSec:86400*26, cpu:9, mem:33, temp:42, latencyMs:1.3, loss:0, trafficInMbps:27, trafficOutMbps:44, clients:29, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-rj-tep-1", hostname:"ap-rj-tep-01", ip:"10.10.30.101", category:"ap", vendor:"Ruijie", model:"RG-RAP2260(G)", buildingId:"tep", floor:"Lt1", status:"warning", uptimeSec:86400*3, cpu:54, mem:68, temp:58, latencyMs:3.8, loss:0.9, trafficInMbps:22, trafficOutMbps:31, clients:18, snmp:true, snmpCommunity:"ruijieRO", site:"main", lastSeen: new Date().toISOString(), notes:"Channel util tinggi" },
  { id:"ap-rj-mesin", hostname:"ap-rj-mesin-lab", ip:"10.10.20.101", category:"ap", vendor:"Ruijie", model:"RG-RAP2266", buildingId:"mesin", floor:"Lab CNC", status:"online", uptimeSec:86400*19, cpu:21, mem:44, temp:49, latencyMs:2.1, loss:0, trafficInMbps:18, trafficOutMbps:26, clients:22, snmp:true, snmpCommunity:"ruijieRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-aula", hostname:"ap-uf-aula-01", ip:"10.10.61.101", category:"ap", vendor:"UniFi", model:"U6-LR", buildingId:"aula", floor:"Hall", status:"online", uptimeSec:86400*9, cpu:13, mem:39, temp:45, latencyMs:1.9, loss:0, trafficInMbps:55, trafficOutMbps:74, clients:67, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-gor-1", hostname:"ap-uf-gor-01", ip:"10.10.62.101", category:"ap", vendor:"UniFi", model:"U6-Pro", buildingId:"gor", floor:"Tribun", status:"offline", uptimeSec:0, cpu:0, mem:0, temp:0, latencyMs:0, loss:100, trafficInMbps:0, trafficOutMbps:0, clients:0, snmp:false, site:"main", lastSeen: new Date(Date.now()-3600*2100).toISOString() },
  { id:"ap-uf-gor-2", hostname:"ap-uf-gor-02", ip:"10.10.62.102", category:"ap", vendor:"UniFi", model:"U6-Pro", buildingId:"gor", floor:"Lapangan", status:"offline", uptimeSec:0, cpu:0, mem:0, temp:0, latencyMs:0, loss:100, trafficInMbps:0, trafficOutMbps:0, clients:0, snmp:false, site:"main", lastSeen: new Date(Date.now()-3600*2100).toISOString() },
  { id:"ap-aruba-rektorat", hostname:"ap-aruba-rek-lobby", ip:"10.10.0.101", category:"ap", vendor:"Aruba", model:"AP-505H", buildingId:"rektorat", floor:"Lobby", status:"online", uptimeSec:86400*31, cpu:8, mem:29, temp:40, latencyMs:0.94, loss:0, trafficInMbps:14, trafficOutMbps:21, clients:16, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-asrama-1", hostname:"ap-uf-asr-a1", ip:"10.10.70.101", category:"ap", vendor:"UniFi", model:"U6-Mesh", buildingId:"asrama", floor:"A-Lt1", status:"online", uptimeSec:86400*14, cpu:18, mem:46, temp:51, latencyMs:2.6, loss:0.1, trafficInMbps:36, trafficOutMbps:58, clients:38, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-asrama-2", hostname:"ap-uf-asr-a2", ip:"10.10.70.102", category:"ap", vendor:"UniFi", model:"U6-Mesh", buildingId:"asrama", floor:"A-Lt2", status:"online", uptimeSec:86400*14, cpu:15, mem:42, temp:49, latencyMs:2.4, loss:0, trafficInMbps:29, trafficOutMbps:47, clients:31, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-rj-kantin", hostname:"ap-rj-ktn-01", ip:"10.10.71.101", category:"ap", vendor:"Ruijie", model:"RG-RAP2200(E)", buildingId:"kantin", floor:"Foodcourt", status:"online", uptimeSec:86400*22, cpu:23, mem:41, temp:50, latencyMs:2.0, loss:0, trafficInMbps:26, trafficOutMbps:39, clients:51, snmp:true, snmpCommunity:"ruijieRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-lab", hostname:"ap-uf-lab-01", ip:"10.10.50.101", category:"ap", vendor:"UniFi", model:"U6-Enterprise", buildingId:"labterpadu", floor:"Lt2", status:"online", uptimeSec:86400*8, cpu:20, mem:49, temp:48, latencyMs:1.5, loss:0, trafficInMbps:61, trafficOutMbps:93, clients:72, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-pet-1", hostname:"ap-uf-pet-01", ip:"10.10.40.101", category:"ap", vendor:"UniFi", model:"U6-Pro", buildingId:"pet", floor:"Lt1", status:"maintenance", uptimeSec:86400*0, cpu:0, mem:0, temp:0, latencyMs:0, loss:0, trafficInMbps:0, trafficOutMbps:0, clients:0, snmp:false, site:"main", lastSeen: new Date().toISOString(), notes:"Firmware upgrade terjadwal 19:00" },
  { id:"ap-aruba-gh", hostname:"ap-aruba-gh-field", ip:"10.10.80.101", category:"ap", vendor:"Aruba", model:"AP-577 ODU", buildingId:"greenhouse", floor:"Outdoor", status:"online", uptimeSec:86400*11, cpu:13, mem:34, temp:54, latencyMs:4.2, loss:0.4, trafficInMbps:8, trafficOutMbps:12, clients:6, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  // Extra switches AP per building to hit 50+ device count
  { id:"sw-unifi-mif", hostname:"sw-uf-mif-01", ip:"10.10.12.3", category:"switch", vendor:"UniFi", model:"USW-24-PoE", buildingId:"mif", floor:"Lt2", status:"online", uptimeSec:86400*17, cpu:10, mem:26, temp:41, latencyMs:1.1, loss:0, trafficInMbps:122, trafficOutMbps:110, poeW:71, snmp:true, snmpCommunity:"unifiRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"sw-juniper-lab", hostname:"sw-jn-lab-01", ip:"10.10.50.3", category:"switch", vendor:"Juniper", model:"EX2300-48P", buildingId:"labterpadu", floor:"Lt2", status:"online", uptimeSec:86400*28, cpu:13, mem:28, temp:40, latencyMs:1.28, loss:0, trafficInMbps:178, trafficOutMbps:162, poeW:93, snmp:true, snmpCommunity:"polijeRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-tip-301", hostname:"ap-uf-tip-301", ip:"10.10.10.103", category:"ap", vendor:"UniFi", model:"U6-Pro", buildingId:"tip", floor:"Lt3", status:"online", uptimeSec:86400*6, cpu:17, mem:44, temp:47, latencyMs:1.9, loss:0, trafficInMbps:39, trafficOutMbps:56, clients:36, snmp:false, site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-rj-pet-2", hostname:"ap-rj-pet-lab", ip:"10.10.40.102", category:"ap", vendor:"Ruijie", model:"RG-RAP2260", buildingId:"pet", floor:"Lab", status:"online", uptimeSec:86400*10, cpu:19, mem:40, temp:46, latencyMs:2.7, loss:0.2, trafficInMbps:11, trafficOutMbps:16, clients:14, snmp:true, snmpCommunity:"ruijieRO", site:"main", lastSeen: new Date().toISOString() },
  { id:"ap-uf-rektorat-2", hostname:"ap-uf-rek-02", ip:"10.10.0.102", category:"ap", vendor:"UniFi", model:"U6-Pro", buildingId:"rektorat", floor:"Lt2", status:"online", uptimeSec:86400*20, cpu:10, mem:34, temp:43, latencyMs:1.0, loss:0, trafficInMbps:19, trafficOutMbps:27, clients:21, snmp:false, site:"main", lastSeen: new Date().toISOString() },
]

const INITIAL_ALERTS: AlertItem[] = [
  { id:"a1", time:new Date(Date.now()-1000*60*11).toISOString(), sev:"crit", deviceId:"sw-aruba-gor", message:"switch sw-aruba-gor-01 DOWN • SNMP timeout • PoE 0W", ack:false },
  { id:"a2", time:new Date(Date.now()-1000*60*19).toISOString(), sev:"warn", deviceId:"sw-ruijie-tep", message:"CPU 57% • temp 53°C • loss 0.3%", ack:false },
  { id:"a3", time:new Date(Date.now()-1000*60*36).toISOString(), sev:"warn", deviceId:"ap-rj-tep-1", message:"Channel utilization tinggi 82% • re-scan RF disarankan", ack:false },
  { id:"a4", time:new Date(Date.now()-1000*60*48).toISOString(), sev:"info", deviceId:"ap-uf-pet-1", message:"Mode maintenance • firmware 7.0.84 upgrade terjadwal", ack:true },
  { id:"a5", time:new Date(Date.now()-1000*60*121).toISOString(), sev:"crit", deviceId:"ap-uf-gor-1", message:"2x AP GOR offline bersamaan dengan switch PoE", ack:false },
  { id:"a6", time:new Date(Date.now()-1000*60*210).toISOString(), sev:"warn", deviceId:"srv-sso", message:"CPU 66% • mem 71% • LDAP burst login pagi", ack:true },
]

const UNIFI_DISCOVERY_SEED: UniFiDiscovery[] = [
  { mac:"f0:9f:c2:a1:2b:10", ip:"10.10.10.101", model:"U6-Pro", adopted:true, site:"POLIJE-TIP", clients:41, version:"7.0.84" },
  { mac:"f0:9f:c2:a1:2b:11", ip:"10.10.10.102", model:"U6-Pro", adopted:true, site:"POLIJE-TIP", clients:33, version:"7.0.84" },
  { mac:"fc:ec:da:77:44:02", ip:"10.10.12.101", model:"U7-Pro", adopted:true, site:"POLIJE-MIF", clients:56, version:"7.1.12" },
  { mac:"68:d7:9a:15:3c:8f", ip:"10.10.61.101", model:"U6-LR", adopted:true, site:"POLIJE-AULA", clients:67, version:"6.6.77" },
  { mac:"fc:ec:da:82:19:aa", ip:"10.10.70.101", model:"U6-Mesh", adopted:true, site:"POLIJE-ASRAMA", clients:38, version:"7.0.84" },
  { mac:"f0:9f:c2:b8:0e:44", ip:"10.10.10.104", model:"U6-Pro", adopted:false, site:"default", clients:0, version:"6.5.62" },
  { mac:"fc:ec:da:9a:21:7b", ip:"10.10.71.102", model:"U6-Enterprise", adopted:false, site:"default", clients:0, version:"7.0.77" },
]

function formatUptime(sec: number){
  if(sec<=0) return "—"
  const d = Math.floor(sec/86400)
  const h = Math.floor((sec%86400)/3600)
  return d>0 ? `${d}d ${h}h` : `${h}h`
}
function formatTraffic(m:number){ return m>1000 ? `${(m/1000).toFixed(2)} Gbps` : `${Math.round(m)} Mbps` }
function timeAgo(iso:string){
  const s = Math.floor((Date.now()-new Date(iso).getTime())/1000)
  if(s<60) return `${s}s`
  if(s<3600) return `${Math.floor(s/60)}m`
  if(s<86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}

const vendorTone: Record<VendorName, string> = {
  MikroTik:"#d9821b",
  Aruba:"#0077ff",
  Ruijie:"#fe3b2e",
  UniFi:"#0152f7",
  Juniper:"#1abf73",
  Dell:"#0b6bcb",
  HPE:"#00b188",
  Supermicro:"#5b5bd6"
}

const API_BASE = import.meta.env.DEV ? "http://localhost:9090/api" : "/api"

export default function App(){
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_BUILDINGS)
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES)
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS)
  const [view, setView] = useState<"overview"|"peta"|"topologi"|"perangkat"|"unifi"|"snmp"|"alerts"|"deploy">("overview")
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState<DeviceCategory | "all">("all")
  const [filterVendor, setFilterVendor] = useState<VendorName | "all">("all")
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | "all">("all")
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [autoPoll, setAutoPoll] = useState(true)

  // SNMP Scanner UI state
  const [scanTarget, setScanTarget] = useState("10.10.0.0/22")
  const [scanCommunities, setScanCommunities] = useState("publicPolije, polijeRO, ruijieRO, unifiRO, public")
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanHits, setScanHits] = useState<Device[]>([])

  // UniFi Autosync state
  const [unifiCtrl, setUnifiCtrl] = useState("https://10.10.1.40:8443")
  const [unifiUser, setUnifiUser] = useState("netmon@polije.ac.id")
  const [unifiSite, setUnifiSite] = useState("POLIJE-MAIN")
  const [unifiAuto, setUnifiAuto] = useState(true)
  const [unifiInterval, setUnifiInterval] = useState(5)
  const [unifiLastSync, setUnifiLastSync] = useState<string>(new Date().toISOString())
  const [unifiDiscovery, setUnifiDiscovery] = useState<UniFiDiscovery[]>(UNIFI_DISCOVERY_SEED)
  const [unifiSyncing, setUnifiSyncing] = useState(false)

  // simulated live bandwidth chart
  const [bwSeries, setBwSeries] = useState<Array<{t:string, in:number, out:number}>>(()=>{
    const base = Date.now()
    return Array.from({length:36}).map((_,i)=>{
      const tm = new Date(base - (35-i)*60000)
      return { t: tm.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}), in: 920+Math.sin(i/3)*210+Math.random()*140, out: 840+Math.cos(i/2.7)*160+Math.random()*110 }
    })
  })

  // Fetch initial data & buildings
  useEffect(() => {
    const initFetch = async () => {
      try {
        const bRes = await fetch(`${API_BASE}/buildings`)
        if (bRes.ok) setBuildings(await bRes.json())

        const dRes = await fetch(`${API_BASE}/devices`)
        if (dRes.ok) setDevices(await dRes.json())

        const aRes = await fetch(`${API_BASE}/alerts`)
        if (aRes.ok) setAlerts(await aRes.json())
      } catch (err) {
        console.error("Initial fetch failed", err)
      }
    }
    initFetch()
  }, [])

  // Poll backend data
  useEffect(() => {
    if (!autoPoll) return
    const id = setInterval(async () => {
      try {
        const dRes = await fetch(`${API_BASE}/devices`)
        if (dRes.ok) setDevices(await dRes.json())

        const aRes = await fetch(`${API_BASE}/alerts`)
        if (aRes.ok) setAlerts(await aRes.json())

        const mRes = await fetch(`${API_BASE}/metrics/traffic`)
        if (mRes.ok) setBwSeries(await mRes.json())
      } catch (err) {
        console.error("Polling failed", err)
      }
    }, 4000)
    return () => clearInterval(id)
  }, [autoPoll])

  const filtered = useMemo(()=>{
    return devices.filter(d=>{
      if(filterCat!=="all" && d.category!==filterCat) return false
      if(filterVendor!=="all" && d.vendor!==filterVendor) return false
      if(filterStatus!=="all" && d.status!==filterStatus) return false
      if(selectedBuilding && d.buildingId!==selectedBuilding) return false
      if(search){
        const q = search.toLowerCase()
        return d.hostname.toLowerCase().includes(q) || d.ip.includes(q) || d.model.toLowerCase().includes(q)
      }
      return true
    })
  }, [devices, filterCat, filterVendor, filterStatus, search, selectedBuilding])

  const kpis = useMemo(()=>{
    const total = devices.length
    const online = devices.filter(d=>d.status==="online").length
    const warn = devices.filter(d=>d.status==="warning").length
    const down = devices.filter(d=>d.status==="offline").length
    const avgLat = devices.filter(d=>d.status==="online").reduce((a,b)=>a+b.latencyMs,0) / Math.max(1, online)
    const loss = devices.reduce((a,b)=>a+b.loss,0) / total
    const tIn = devices.reduce((a,b)=>a+b.trafficInMbps,0)
    const tOut = devices.reduce((a,b)=>a+b.trafficOutMbps,0)
    const clients = devices.filter(d=>d.clients).reduce((a,b)=>a+(b.clients||0),0)
    return { total, online, warn, down, avgLat, loss, tIn, tOut, clients }
  }, [devices])

  const doSnmpScan = async () => {
    setScanning(true)
    setScanProgress(0)
    setScanHits([])
    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cidr: scanTarget,
          communities: scanCommunities.split(",").map(c => c.trim())
        })
      })
      if (!res.ok) {
        setScanning(false)
        return
      }

      const pollTimer = setInterval(async () => {
        try {
          const progRes = await fetch(`${API_BASE}/scan`)
          if (progRes.ok) {
            const prog = await progRes.json()
            setScanProgress(prog.percent)
            if (prog.results) {
              setScanHits(prog.results.map((r: any) => ({
                id: r.ip,
                hostname: r.hostname || `sw-${r.ip.replace(/\./g, "-")}`,
                ip: r.ip,
                category: "switch",
                vendor: r.vendor || "Unknown",
                model: r.model || "Unknown",
                buildingId: "tik",
                status: "online",
                uptimeSec: 3600,
                cpu: 0, mem: 0, temp: 0, latencyMs: r.latencyMs, loss: 0,
                trafficInMbps: 0, trafficOutMbps: 0,
                snmp: r.community !== "",
                snmpCommunity: r.community,
                site: "main",
                lastSeen: new Date().toISOString()
              })))
            }
            if (!prog.running) {
              clearInterval(pollTimer)
              setScanning(false)
            }
          }
        } catch {
          clearInterval(pollTimer)
          setScanning(false)
        }
      }, 1000)
    } catch (err) {
      console.error(err)
      setScanning(false)
    }
  }

  const doUniFiSync = async () => {
    setUnifiSyncing(true)
    try {
      const res = await fetch(`${API_BASE}/unifi/sync`, { method: "POST" })
      if (res.ok) {
        const list = await res.json()
        setUnifiDiscovery(list)
        setUnifiLastSync(new Date().toISOString())
        
        // Reload devices after adoption/sync
        const dRes = await fetch(`${API_BASE}/devices`)
        if (dRes.ok) setDevices(await dRes.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUnifiSyncing(false)
    }
  }

  const ackAlert = async (id: string, currentAck: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}/ack?ack=${!currentAck}`, { method: "POST" })
      if (res.ok) {
        const aRes = await fetch(`${API_BASE}/alerts`)
        if (aRes.ok) setAlerts(await aRes.json())
      }
    } catch (err) {
      console.error(err)
    }
  }

  const ackAllAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts/ack-all`, { method: "POST" })
      if (res.ok) {
        const aRes = await fetch(`${API_BASE}/alerts`)
        if (aRes.ok) setAlerts(await aRes.json())
      }
    } catch (err) {
      console.error(err)
    }
  }

  const importDevice = async (ip: string) => {
    try {
      const res = await fetch(`${API_BASE}/scan/${ip}/import`, { method: "POST" })
      if (res.ok) {
        const dRes = await fetch(`${API_BASE}/devices`)
        if (dRes.ok) setDevices(await dRes.json())
      }
    } catch (err) {
      console.error(err)
    }
  }

  // UniFi auto interval
  useEffect(() => {
    if (!unifiAuto) return
    const iid = setInterval(() => {
      doUniFiSync()
    }, unifiInterval * 60 * 1000)
    return () => clearInterval(iid)
  }, [unifiAuto, unifiInterval])

  const navItems = [
    { id:"overview", label:"Overview", icon: LayoutDashboard },
    { id:"peta", label:"Peta Visual", icon: MapPinned },
    { id:"topologi", label:"Topologi", icon: Network },
    { id:"perangkat", label:"Perangkat", icon: ServerIcon },
    { id:"unifi", label:"UniFi AutoSync", icon: Wifi },
    { id:"snmp", label:"SNMP Scanner", icon: SearchCode },
    { id:"alerts", label:"Alert", icon: AlertTriangle, badge: alerts.filter(a=>!a.ack).length },
    { id:"deploy", label:"Deploy & WSL", icon: SquareTerminal },
  ] as const

  return (
    <div style={{fontFamily:"Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"}} className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-zinc-200/70">
        <div className="max-w-[1320px] mx-auto px-[22px] sm:px-8 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[12px] bg-[#111] flex items-center justify-center shadow-sm">
              <Waves className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <div className="text-[16px] font-[630] tracking-[-0.011em] leading-tight">NetMon Polije</div>
              <div className="text-[11.5px] text-zinc-500 -mt-[1px]">Campus Network Monitoring • Jember</div>
            </div>
            <span className="ml-3 hidden md:inline-flex text-[11px] font-medium px-2 py-[3px] rounded-full bg-[#f0fdf4] text-emerald-700 border border-emerald-200">v2.6 • Stable Fast</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={()=>setAutoPoll(v=>!v)}
              className={`hidden sm:flex items-center gap-2 text-[12.5px] px-3 py-[7px] rounded-full border transition ${autoPoll ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"}`}
            >
              <Activity className="w-3.5 h-3.5" />
              {autoPoll ? "Live 3s" : "Paused"}
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-[12.5px] font-[560]">UPT TIK</div>
              <div className="text-[11px] text-zinc-500 -mt-0.5">netmon@polije.ac.id</div>
            </div>
            <img src="https://i.pravatar.cc/40?img=12" className="w-8 h-8 rounded-full border border-zinc-200" alt="" />
          </div>
        </div>
      </header>

      <div className="max-w-[1320px] mx-auto px-[18px] sm:px-8 py-7 md:py-9 grid grid-cols-12 gap-[18px] md:gap-6">
        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2">
          <div className="bg-white rounded-[20px] border border-zinc-200 shadow-[0_1px_1px_rgba(0,0,0,0.035)] lg:sticky lg:top-[84px]">
            <div className="p-[12px]">
              <div className="text-[11px] uppercase tracking-[0.11em] text-zinc-400 px-3 pt-2 pb-1">Navigasi</div>
              <nav className="space-y-[4px]">
                {navItems.map(n=>{
                  const Icon = n.icon
                  const active = view===n.id
                  return (
                    <button
                      key={n.id}
                      onClick={()=>setView(n.id as any)}
                      className={`w-full text-left flex items-center justify-between px-3 py-[10px] rounded-[14px] text-[13.7px] transition ${active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
                    >
                      <span className="flex items-center gap-[10px]">
                        <Icon className="w-[17px] h-[17px]" />
                        {n.label}
                      </span>
                      {"badge" in n && (n.badge as number) >0 ? (
                        <span className={`text-[10.5px] font-[620] rounded-full px-[8px] py-[2px] ${active ? "bg-white/15 text-white":"bg-[#ff3b30]/10 text-[#ff3b30]"}`}>{n.badge}</span>
                      ) : n.id==="unifi" ? (
                        <span className="w-[7px] h-[7px] rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.43)]" />
                      ) : null}
                    </button>
                  )
                })}
              </nav>
            </div>
            <div className="border-t border-zinc-100 px-4 py-4 text-[11.8px] text-zinc-500">
              <div className="font-[560] text-zinc-700 text-[12.3px] mb-1">Jember Main Campus</div>
              8.1598°S 113.7231°E<br/>
              14 gedung • 4 site PSDKU<br/>
              <div className="mt-2 flex flex-wrap gap-[6px] text-[10.5px]">
                {["MikroTik","Aruba","Ruijie","UniFi","Juniper"].map(v=>(
                  <span key={v} className="px-[8px] py-[2px] rounded-full bg-zinc-100 text-zinc-600">{v}</span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="col-span-12 lg:col-span-9 xl:col-span-10 space-y-[18px] md:space-y-6">
          {view==="overview" && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-[16px]">
                <KpiCard label="Total Perangkat" value={String(kpis.total)} sub={`${kpis.online} online`} icon={<Boxes className="w-4 h-4"/>} tone="zinc"/>
                <KpiCard label="Online" value={`${Math.round(kpis.online/kpis.total*100)}%`} sub={`${kpis.online} / ${kpis.total}`} icon={<CheckCircle2 className="w-4 h-4"/>} tone="green"/>
                <KpiCard label="Warning" value={String(kpis.warn)} sub="perlu perhatian" icon={<AlertTriangle className="w-4 h-4"/>} tone="amber"/>
                <KpiCard label="Down" value={String(kpis.down)} sub="auto-ticket" icon={<Zap className="w-4 h-4"/>} tone="red"/>
                <KpiCard label="Latency Avg" value={`${kpis.avgLat.toFixed(2)} ms`} sub="campus core" icon={<Signal className="w-4 h-4"/>} tone="blue"/>
                <KpiCard label="Klien Wi-Fi" value={`${kpis.clients}`} sub="assoc realtime" icon={<Wifi className="w-4 h-4"/>} tone="indigo"/>
              </div>

              {/* bandwidth + right column */}
              <div className="grid grid-cols-12 gap-[16px] md:gap-5">
                <div className="col-span-12 xl:col-span-8 bg-white rounded-[22px] border border-zinc-200 p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-[14.5px] font-[620]">Throughput Backbone</div>
                      <div className="text-[12px] text-zinc-500">CCR2116 Core • 36 menit terakhir</div>
                    </div>
                    <div className="flex gap-4 text-[11.8px]">
                      <span className="flex items-center gap-2 text-zinc-600"><span className="w-[9px] h-[9px] rounded-full bg-[#007aff]" /> In {formatTraffic(kpis.tIn)}</span>
                      <span className="flex items-center gap-2 text-zinc-600"><span className="w-[9px] h-[9px] rounded-full bg-[#34c759]" /> Out {formatTraffic(kpis.tOut)}</span>
                    </div>
                  </div>
                  <div className="h-[290px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={bwSeries} margin={{ top:10, right:18, left:-8, bottom:0 }}>
                        <defs>
                          <linearGradient id="ain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007aff" stopOpacity={0.30}/>
                            <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="aout" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34c759" stopOpacity={0.28}/>
                            <stop offset="95%" stopColor="#34c759" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ececec" />
                        <XAxis dataKey="t" tick={{fontSize:11, fill:"#888"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11, fill:"#888"}} axisLine={false} tickLine={false} width={44}/>
                        <RechartsTooltip contentStyle={{borderRadius:14, borderColor:"#e6e6e6", fontSize:12}}/>
                        <Area type="monotone" dataKey="in" stroke="#007aff" strokeWidth={2.2} fill="url(#ain)" />
                        <Area type="monotone" dataKey="out" stroke="#34c759" strokeWidth={2.2} fill="url(#aout)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="col-span-12 xl:col-span-4 space-y-[16px]">
                  <div className="bg-white rounded-[22px] border border-zinc-200 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[14.5px] font-[620]">Insiden Aktif</div>
                      <span className="text-[10.5px] px-[9px] py-[3px] rounded-full bg-red-50 text-red-600 font-[600]">{alerts.filter(a=>!a.ack).length} open</span>
                    </div>
                    <div className="space-y-[10px] max-h-[250px] overflow-auto pr-1">
                      {alerts.slice(0,5).map(a=>{
                        const d = devices.find(x=>x.id===a.deviceId)
                        return (
                          <div key={a.id} className="flex gap-3 text-[12.7px]">
                            <div className={`mt-[5px] w-[7px] h-[7px] rounded-full flex-shrink-0 ${a.sev==="crit"?"bg-red-500":a.sev==="warn"?"bg-amber-500":"bg-sky-500"}`} />
                            <div className="min-w-0">
                              <div className="text-zinc-900 leading-[1.35]">{a.message}</div>
                              <div className="text-[11px] text-zinc-500">{timeAgo(a.time)} lalu • {d?.hostname ?? a.deviceId}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-white rounded-[22px] border border-zinc-200 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                    <div className="text-[14.5px] font-[620] mb-3">Top Talkers</div>
                    <div className="space-y-[10px]">
                      {devices.filter(d=>d.status==="online").sort((a,b)=>(b.trafficInMbps+b.trafficOutMbps)-(a.trafficInMbps+a.trafficOutMbps)).slice(0,4).map(d=>(
                        <div key={d.id} className="flex items-center justify-between text-[12.8px]">
                          <div className="min-w-0">
                            <div className="font-[520] text-zinc-800 truncate">{d.hostname}</div>
                            <div className="text-[11px] text-zinc-500">{d.ip} • {d.vendor}</div>
                          </div>
                          <div className="text-right text-[11.6px] text-zinc-600">
                            {formatTraffic(d.trafficInMbps+d.trafficOutMbps)}<br/>
                            <span className="text-zinc-400">{d.latencyMs.toFixed(2)} ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* site health */}
              <div className="bg-white rounded-[22px] border border-zinc-200 p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[15px] font-[620]">Kesehatan per Gedung</div>
                  <div className="text-[11.8px] text-zinc-500">SNMP v2c • ICMP 1s</div>
                </div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-[12px]">
                  {buildings.map(b=>{
                    const devs = devices.filter(d=>d.buildingId===b.id)
                    const ok = devs.filter(d=>d.status==="online").length
                    const pct = devs.length ? Math.round(ok/devs.length*100) : 0
                    return (
                      <div key={b.id} className="rounded-[16px] border border-zinc-200 px-[14px] py-[13px] hover:border-zinc-300 transition">
                        <div className="flex items-center justify-between">
                          <div className="text-[13.2px] font-[560]">{b.short}</div>
                          <div className={`text-[10.7px] px-[8px] py-[2px] rounded-full ${pct>=95 ? "bg-emerald-50 text-emerald-700" : pct>=80 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{pct}%</div>
                        </div>
                        <div className="text-[11.4px] text-zinc-500 mt-[2px]">{b.name}</div>
                        <div className="text-[11px] text-zinc-500 mt-1">{b.subnet} • VLAN {b.vlan}</div>
                        <div className="text-[11px] text-zinc-600 mt-[6px]">{ok}/{devs.length} online • {devs.filter(d=>d.category==="ap").length} AP</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {view==="peta" && (
            <div className="bg-white rounded-[22px] border border-zinc-200 p-5 md:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-[17px] font-[630] tracking-[-0.011em]">Peta Visual Kampus Polije</div>
                  <div className="text-[12.5px] text-zinc-500">Jl. Mastrip PO BOX 164 Jember • titik perangkat live</div>
                </div>
                <div className="flex items-center gap-2 text-[11.5px]">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Online</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Warn</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />Down</span>
                </div>
              </div>

              <div className="rounded-[18px] border border-zinc-200 bg-[#fbfbfd] overflow-hidden">
                <svg viewBox="0 0 1060 600" className="w-full h-auto">
                  <defs>
                    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#eaeaea" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="1060" height="600" fill="url(#grid)"/>
                  {/* backbone paths */}
                  <g stroke="#c6d8fb" strokeWidth="3" fill="none" opacity={0.9}>
                    <path d="M500 160 C420 205 360 220 350 245" />
                    <path d="M603 271 C700 280 710 308 800 338" />
                    <path d="M500 271 C420 295 350 310 198 340" />
                    <path d="M580 362 C500 400 430 420 293 445" />
                    <path d="M620 448 C560 482 500 505 490 540" />
                    <path d="M720 448 C700 482 690 502 738 535" />
                  </g>

                  {buildings.map(b=>{
                    const devs = devices.filter(d=>d.buildingId===b.id)
                    const bad = devs.some(d=>d.status==="offline")
                    const warn = devs.some(d=>d.status==="warning")
                    return (
                      <g key={b.id} style={{cursor:"pointer"}}
                         onClick={()=>setSelectedBuilding(selectedBuilding===b.id? null : b.id)}
                      >
                        <rect
                          x={b.x} y={b.y} width={b.w} height={b.h}
                          rx={16} ry={16}
                          fill={selectedBuilding===b.id ? "#ffffff" : b.color}
                          stroke={bad ? "#ff3b30" : warn ? "#f59e0b" : selectedBuilding===b.id ? "#0a84ff" : "#d7dae0"}
                          strokeWidth={selectedBuilding===b.id ? 2.2 : 1.4}
                        />
                        <text x={b.x+14} y={b.y+26} fontSize="12.5" fontWeight="600" fill="#1f2430">{b.short}</text>
                        <text x={b.x+14} y={b.y+44} fontSize="10.5" fill="#6a7282">{b.name.length>30 ? b.name.slice(0,30)+'…' : b.name}</text>
                        <text x={b.x+14} y={b.y+b.h-12} fontSize="10.5" fill="#7a808c">{devs.length} perangkat • VLAN {b.vlan}</text>
                      </g>
                    )
                  })}

                  {/* device dots */}
                  {devices.map(d=>{
                    const b = buildings.find(bb=>bb.id===d.buildingId)
                    if(!b) return null
                    const i = devices.filter(x=>x.buildingId===b.id).findIndex(x=>x.id===d.id)
                    const dx = b.x + 16 + (i%6)*22
                    const dy = b.y + b.h - 30
                    const fill = d.status==="online" ? "#10b981" : d.status==="warning" ? "#f59e0b" : d.status==="maintenance" ? "#6366f1" : "#9aa0a6"
                    return (
                      <g key={d.id} onClick={()=> setSelectedDevice(d)} style={{cursor:"pointer"}}>
                        <circle cx={dx} cy={dy} r={5.2} fill={fill} />
                        <circle cx={dx} cy={dy} r={9} fill="transparent" />
                        <title>{d.hostname} • {d.ip} • {d.latencyMs}ms</title>
                      </g>
                    )
                  })}
                </svg>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mt-4 text-[11.4px]">
                {[
                  {k:"Core CCR2116", v:"2 unit HA", t:"MikroTik"},
                  {k:"Distribusi", v:"5 switch L3", t:"Aruba/Juniper"},
                  {k:"Akses", v:"9 switch PoE", t:"Ruijie/UniFi"},
                  {k:"AP aktif", v: devices.filter(d=>d.category==="ap" && d.status==="online").length+" unit", t:"mixed"},
                  {k:"Link backbone", v:"10G FO SM", t:"OS2"},
                  {k:"Client peak", v:"~1.840", t:"802.11ax"},
                  {k:"Uptime campus", v:"99.93%", t:"30d"},
                ].map(c=>(
                  <div key={c.k} className="rounded-[14px] border border-zinc-200 px-3 py-[10px] bg-zinc-50/65">
                    <div className="text-zinc-500">{c.k}</div>
                    <div className="font-[560] text-zinc-900">{c.v}</div>
                    <div className="text-zinc-400">{c.t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view==="topologi" && (
            <div className="bg-white rounded-[22px] border border-zinc-200 p-5 md:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[17px] font-[630]">Topologi L3 • Polije Campus Spine-Leaf</div>
                <div className="text-[11.8px] text-zinc-500">Auto-discovered via LLDP / CDP / SNMP</div>
              </div>

              <div className="rounded-[18px] border border-zinc-200 bg-[#fbfbfd] overflow-auto">
                <svg viewBox="0 0 1180 540" className="w-full min-w-[980px]">
                  {/* core */}
                  <g>
                    <rect x={480} y={34} width={220} height={62} rx={16} fill="#fff" stroke="#0a84ff" strokeWidth={1.7}/>
                    <text x={590} y={62} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1d1d23">CCR2116 CORE HA</text>
                    <text x={590} y={80} textAnchor="middle" fontSize="10.5" fill="#697186">10.10.0.1 / .2 • VRRP</text>
                  </g>
                  {/* distribution switches */}
                  {[
                    {x:120,y:165,label:"Aruba TIP", ip:"10.10.10.2"},
                    {x:360,y:165,label:"UniFi TIK", ip:"10.10.1.5"},
                    {x:590,y:165,label:"Juniper REK", ip:"10.10.0.10"},
                    {x:820,y:165,label:"Ruijie MIF", ip:"10.10.12.2"},
                    {x:1020,y:165,label:"Ruijie LAB", ip:"10.10.50.2"},
                  ].map(n=>(
                    <g key={n.label}>
                      <line x1={590} y1={96} x2={n.x+68} y2={n.y} stroke="#c8d7ff" strokeWidth={2}/>
                      <rect x={n.x} y={n.y} width={136} height={54} rx={14} fill="#fff" stroke="#d6d9e1"/>
                      <text x={n.x+68} y={n.y+24} textAnchor="middle" fontSize="12" fontWeight="600" fill="#23262d">{n.label}</text>
                      <text x={n.x+68} y={n.y+41} textAnchor="middle" fontSize="10" fill="#748095">{n.ip}</text>
                    </g>
                  ))}
                  {/* access layer cloud */}
                  {[
                    {x:40,y:306, t:"AP TIP x3\nU6-Pro"},
                    {x:220,y:306, t:"SW Mesin\nAruba 2530"},
                    {x:395,y:306, t:"SW TEP\nRG-S2910"},
                    {x:565,y:306, t:"AP Aula\nU6-LR"},
                    {x:735,y:306, t:"AP ASRAMA\nU6-Mesh x2"},
                    {x:910,y:306, t:"SW PERPUS\nUSW-24"},
                    {x:1036,y:306, t:"AP GH\nAP-577"},
                  ].map((n,i)=>(
                    <g key={i}>
                      <line x1={120+ i*170} y1={219} x2={n.x+56} y2={n.y} stroke="#e0e3ea" />
                      <rect x={n.x} y={n.y} width={112} height={58} rx={14} fill="#fdfdfd" stroke="#e5e7ef"/>
                      <text x={n.x+56} y={n.y+25} textAnchor="middle" fontSize="11" fill="#384050" style={{whiteSpace:"pre"}}>
                        {n.t.split("\n")[0]}
                      </text>
                      <text x={n.x+56} y={n.y+42} textAnchor="middle" fontSize="10" fill="#6b7285">
                        {n.t.split("\n")[1]||""}
                      </text>
                    </g>
                  ))}
                  {/* bottom server rack */}
                  <rect x={410} y={426} width={360} height={72} rx={16} fill="#f8fafc" stroke="#d8dde8"/>
                  <text x={590} y={452} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#222533">Data Center TIK – Proxmox HA</text>
                  <text x={590} y={471} textAnchor="middle" fontSize="10.5" fill="#677084">PVE-01 • PVE-02 • NAS • Radius • Zabbix • UniFi Ctrl</text>
                  <text x={590} y={488} textAnchor="middle" fontSize="10.5" fill="#7b8392">10.10.1.0/24 • 10G LACP • UPS Eaton 9PX</text>
                </svg>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-4 text-[12.4px]">
                <div className="rounded-[14px] bg-zinc-50 border border-zinc-200 px-4 py-3">
                  <div className="font-[560] mb-1">Routing</div>
                  <div className="text-zinc-600">OSPF Area 0 • BGP uplink Jalin • VRRP core</div>
                </div>
                <div className="rounded-[14px] bg-zinc-50 border border-zinc-200 px-4 py-3">
                  <div className="font-[560] mb-1">VLAN Campus</div>
                  <div className="text-zinc-600">VLAN 1,10,110–180 • 802.1X • RADIUS Polije</div>
                </div>
                <div className="rounded-[14px] bg-zinc-50 border border-zinc-200 px-4 py-3">
                  <div className="font-[560] mb-1">Wireless</div>
                  <div className="text-zinc-600">eduroam • Polije-Secure • Polije-Guest (VLAN 171)</div>
                </div>
              </div>
            </div>
          )}

          {view==="perangkat" && (
            <div className="bg-white rounded-[22px] border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
              <div className="px-5 md:px-6 pt-5 pb-4 border-b border-zinc-100 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[230px]">
                  <div className="text-[11px] text-zinc-500 mb-1">Cari perangkat</div>
                  <input
                    value={search}
                    onChange={e=>setSearch(e.target.value)}
                    placeholder="hostname / ip / model ..."
                    className="w-full rounded-[12px] border border-zinc-300 px-3 py-[9px] text-[13.3px] focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/25 focus:border-[#0a84ff]"
                  />
                </div>
                <FilterSelect label="Kategori" value={filterCat} onChange={v=>setFilterCat(v as any)} options={[
                  ["all","Semua"],["server","Server"],["router","Router"],["switch","Switch"],["ap","Access Point"]
                ]}/>
                <FilterSelect label="Vendor" value={filterVendor} onChange={v=>setFilterVendor(v as any)} options={[
                  ["all","Semua vendor"],"MikroTik","Aruba","Ruijie","UniFi","Juniper","Dell","HPE","Supermicro"
                ].map(o=> typeof o==="string"? [o,o]:o as any)}/>
                <FilterSelect label="Status" value={filterStatus} onChange={v=>setFilterStatus(v as any)} options={[
                  ["all","Semua"],["online","Online"],["warning","Warning"],["offline","Offline"],["maintenance","Maintenance"]
                ]}/>
                <button onClick={()=>{
                  setSearch("")
                  setFilterCat("all")
                  setFilterVendor("all")
                  setFilterStatus("all")
                  setSelectedBuilding(null)
                }} className="text-[12.5px] px-3 py-[9px] rounded-[12px] border border-zinc-300 text-zinc-700 hover:bg-zinc-50">Reset</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#f9f9fb] text-[11.5px] text-zinc-500 uppercase tracking-wide">
                    <tr>
                      {["Perangkat","Lokasi","Status","CPU","Mem","Latency","Traffic","Klien","SNMP"].map(h=>(
                        <th key={h} className="text-left font-[560] px-5 py-[11px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d=>(
                      <tr key={d.id} onClick={()=>setSelectedDevice(d)} className="border-t border-zinc-100 hover:bg-zinc-50/90 cursor-pointer">
                        <td className="px-5 py-[13px] min-w-[270px]">
                          <div className="flex items-center gap-[10px]">
                            <div className="w-[34px] h-[34px] rounded-[10px] bg-zinc-100 flex items-center justify-center text-zinc-700">
                              {d.category==="server" ? <Database className="w-[16px] h-[16px]" /> :
                               d.category==="router" ? <Router className="w-[16px] h-[16px]" /> :
                               d.category==="switch" ? <EthernetPort className="w-[16px] h-[16px]" /> :
                               <Antenna className="w-[16px] h-[16px]" />}
                            </div>
                            <div>
                              <div className="font-[550] text-zinc-900">{d.hostname}</div>
                              <div className="text-[11.8px] text-zinc-500">{d.ip} • <span style={{color:vendorTone[d.vendor]}} className="font-[520]">{d.vendor}</span> {d.model}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-[13px] text-[12.7px] text-zinc-600">
                           {buildings.find(b=>b.id===d.buildingId)?.short} • {d.floor||"-"}
                        </td>
                        <td className="px-5 py-[13px]">
                          <StatusPill status={d.status}/>
                          <div className="text-[11px] text-zinc-500 mt-[2px]">up {formatUptime(d.uptimeSec)}</div>
                        </td>
                        <td className="px-5 py-[13px]">{d.status==="offline"?"—":`${d.cpu.toFixed(0)}%`}</td>
                        <td className="px-5 py-[13px]">{d.status==="offline"?"—":`${d.mem.toFixed(0)}%`}</td>
                        <td className="px-5 py-[13px]">{d.latencyMs? `${d.latencyMs.toFixed(2)} ms`:"—"}</td>
                        <td className="px-5 py-[13px] text-[12px] text-zinc-700">
                          ↓ {Math.round(d.trafficInMbps)} / ↑ {Math.round(d.trafficOutMbps)} Mbps
                        </td>
                        <td className="px-5 py-[13px]">{d.clients ?? "—"}</td>
                        <td className="px-5 py-[13px]">
                          {d.snmp ? <span className="text-[11px] px-[8px] py-[3px] bg-emerald-50 text-emerald-700 rounded-full font-[520]">{d.snmpCommunity||"RO"}</span>
                            : <span className="text-[11px] text-zinc-400">—</span>}
                        </td>
                      </tr>
                    ))}
                    {filtered.length===0 && (
                      <tr><td colSpan={9} className="px-5 py-14 text-center text-zinc-500">Tidak ada perangkat cocok dengan filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-zinc-100 text-[11.8px] text-zinc-500 flex justify-between">
                <span>Menampilkan {filtered.length} dari {devices.length} perangkat</span>
                <span>Polling SNMP/ICMP • interval 30s</span>
              </div>
            </div>
          )}

          {view==="unifi" && (
            <div className="grid grid-cols-12 gap-[16px]">
              <div className="col-span-12 xl:col-span-5 bg-white rounded-[22px] border border-zinc-200 p-[20px] md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[15.5px] font-[630]">UniFi Controller AutoSync</div>
                    <div className="text-[12px] text-zinc-500">Native UniFi OS • UDM / Cloud Key</div>
                  </div>
                  <span className="text-[11px] font-[600] px-[10px] py-[4px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Connected</span>
                </div>
                <div className="grid gap-[12px] text-[13.2px]">
                  <LabeledInput label="Controller URL" value={unifiCtrl} onChange={setUnifiCtrl}/>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <LabeledInput label="Admin / API user" value={unifiUser} onChange={setUnifiUser}/>
                    <LabeledInput label="Site" value={unifiSite} onChange={setUnifiSite}/>
                  </div>
                  <div className="flex items-center gap-3 text-[12.5px]">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={unifiAuto} onChange={e=>setUnifiAuto(e.target.checked)} />
                      AutoSync aktif
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">Interval</span>
                      <select value={unifiInterval} onChange={e=>setUnifiInterval(parseInt(e.target.value))} className="border border-zinc-300 rounded-[9px] px-2 py-[4px] text-[12.5px] bg-white">
                        <option value={1}>1 menit</option>
                        <option value={5}>5 menit</option>
                        <option value={15}>15 menit</option>
                        <option value={30}>30 menit</option>
                      </select>
                    </div>
                  </div>
                  <div className="rounded-[14px] bg-[#f7f9ff] border border-[#d7e4ff] px-4 py-3 text-[12.3px] text-[#2443a9]">
                    Last sync: <b>{timeAgo(unifiLastSync)} lalu</b> • {unifiDiscovery.filter(u=>u.adopted).length} adopted • {unifiDiscovery.filter(u=>!u.adopted).length} pending
                  </div>
                  <button
                    onClick={doUniFiSync}
                    disabled={unifiSyncing}
                    className="w-full flex items-center justify-center gap-2 rounded-[14px] bg-zinc-900 text-white py-[11px] text-[13.5px] font-[560] disabled:opacity-60"
                  >
                    <RefreshCcw className={`w-4 h-4 ${unifiSyncing?"animate-spin":""}`} />
                    {unifiSyncing ? "Syncing..." : "Sync Now / Adopt Pending"}
                  </button>
                  <div className="text-[11.8px] text-zinc-500 leading-relaxed pt-1">
                    Connector: Python FastAPI • unifi-poller • WebSocket events • auto import ke inventory • tag lokasi gedung otomatis via AP name prefix.
                  </div>
                </div>
              </div>

              <div className="col-span-12 xl:col-span-7 bg-white rounded-[22px] border border-zinc-200 p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                <div className="text-[15px] font-[620] mb-3">Discovered UniFi Devices</div>
                <div className="overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead className="text-[11.3px] text-zinc-500 uppercase tracking-wide">
                      <tr className="border-b border-zinc-100">
                        <th className="text-left py-[9px] pr-3">Model</th>
                        <th className="text-left py-[9px] pr-3">IP / MAC</th>
                        <th className="text-left py-[9px] pr-3">Site</th>
                        <th className="text-left py-[9px] pr-3">Clients</th>
                        <th className="text-left py-[9px] pr-3">FW</th>
                        <th className="text-left py-[9px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unifiDiscovery.map(u=>(
                        <tr key={u.mac} className="border-b border-zinc-50">
                          <td className="py-[11px] pr-3 font-[520]">{u.model}</td>
                          <td className="py-[11px] pr-3 text-zinc-600 text-[12.3px]">{u.ip}<br/><span className="text-[11px] text-zinc-500">{u.mac}</span></td>
                          <td className="py-[11px] pr-3 text-zinc-700">{u.site}</td>
                          <td className="py-[11px] pr-3">{u.clients}</td>
                          <td className="py-[11px] pr-3 text-zinc-600">{u.version}</td>
                          <td className="py-[11px]">
                            {u.adopted
                              ? <span className="text-[11px] px-[8px] py-[3px] rounded-full bg-emerald-50 text-emerald-700 font-[560]">adopted</span>
                              : <span className="text-[11px] px-[8px] py-[3px] rounded-full bg-amber-50 text-amber-700 font-[560]">pending</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-[12px] text-zinc-600 bg-zinc-50 rounded-[14px] px-4 py-3 border border-zinc-200">
                  Auto-tagging rules aktif: <code className="bg-white border px-[6px] py-[1px] rounded">ap-uf-*</code> → AP, <code className="bg-white border px-[6px] py-[1px] rounded">sw-uf-*</code> → Switch.
                  SNMP fallback disable (UniFi API native).
                </div>
              </div>
            </div>
          )}

          {view==="snmp" && (
            <div className="grid grid-cols-12 gap-[16px]">
              <div className="col-span-12 lg:col-span-5 bg-white rounded-[22px] border border-zinc-200 p-[20px] md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                <div className="text-[15.5px] font-[630] mb-1">SNMP Network Auto-Discovery</div>
                <div className="text-[12.3px] text-zinc-500 mb-4">Fast ping sweep + SNMP bulk walk • Aruba / Ruijie / Juniper / MikroTik</div>

                <div className="space-y-[13px] text-[13.2px]">
                  <LabeledInput label="Target CIDR / range" value={scanTarget} onChange={setScanTarget} placeholder="10.10.0.0/21 , 10.10.60.0/24"/>
                  <div>
                    <div className="text-[12px] text-zinc-600 mb-[6px]">Community strings (dicoba berurutan)</div>
                    <input
                      value={scanCommunities}
                      onChange={e=>setScanCommunities(e.target.value)}
                      className="w-full rounded-[12px] border border-zinc-300 px-3 py-[9px] text-[13.2px] focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/22"
                    />
                    <div className="text-[11.2px] text-zinc-500 mt-1">disarankan: RO berbeda per vendor.</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-[12.3px]">
                    <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> SNMP v2c</label>
                    <label className="flex items-center gap-2"><input type="checkbox" /> SNMP v3</label>
                    <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> LLDP map</label>
                  </div>
                  {scanning && (
                    <div>
                      <div className="flex justify-between text-[11.8px] text-zinc-600 mb-1"><span>Scanning…</span><span>{scanProgress.toFixed(0)}%</span></div>
                      <div className="h-[8px] bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#0a84ff] transition-all" style={{width:`${scanProgress}%`}}/>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={doSnmpScan}
                    disabled={scanning}
                    className="w-full rounded-[14px] py-[11px] font-[560] text-white bg-zinc-900 disabled:opacity-60"
                  >
                    {scanning ? "Scanning..." : "Mulai Network Scan"}
                  </button>

                  <div className="text-[11.9px] text-zinc-600 rounded-[14px] bg-zinc-50 border border-zinc-200 px-4 py-3 leading-relaxed">
                    Engine: Go (gopacket + gosnmp)  • timeout 750ms • concurrency 256 • WSL NAT aware (use <code>--bind 0.0.0.0</code>)<br/>
                    OIDs: sysDescr • ifHCInOctets • entPhysical • poe • lldpRemTable.
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-7 bg-white rounded-[22px] border border-zinc-200 p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[15px] font-[620]">Hasil Discovery</div>
                  <span className="text-[11.7px] text-zinc-500">{scanHits.length} perangkat ditemukan</span>
                </div>
                <div className="overflow-auto rounded-[14px] border border-zinc-200">
                  <table className="w-full text-[13px]">
                    <thead className="bg-zinc-50 text-[11.2px] text-zinc-500 uppercase">
                      <tr>
                        <th className="text-left px-3 py-[9px]">IP</th>
                        <th className="text-left px-3 py-[9px]">sysName</th>
                        <th className="text-left px-3 py-[9px]">Vendor / Model</th>
                        <th className="text-left px-3 py-[9px]">RO</th>
                        <th className="text-left px-3 py-[9px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanHits.length===0 && (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-500 text-[13px]">{scanning ? "Sedang memindai subnet…" : "Belum ada hasil. Jalankan scan untuk auto-detect."}</td></tr>
                      )}
                      {scanHits.map(h=>(
                        <tr key={h.id+"scan"} className="border-t border-zinc-100">
                          <td className="px-3 py-[10px] font-[500]">{h.ip}</td>
                          <td className="px-3 py-[10px]">{h.hostname}</td>
                          <td className="px-3 py-[10px] text-zinc-600">{h.vendor} {h.model}</td>
                          <td className="px-3 py-[10px] text-[11.8px] text-zinc-600">{h.snmpCommunity}</td>
                          <td className="px-3 py-[10px]">
                            <button
                              onClick={() => importDevice(h.ip)}
                              className="text-[11.6px] px-[10px] py-[5px] rounded-[9px] border border-zinc-300 hover:bg-zinc-50"
                            >Import</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* WSL help */}
                <div className="mt-4 grid md:grid-cols-2 gap-3 text-[11.85px] leading-relaxed">
                  <div className="rounded-[14px] bg-[#f8fafc] border border-zinc-200 px-4 py-3 text-zinc-700">
                    <div className="font-[600] mb-1 flex items-center gap-1.5"><TerminalSquare className="w-3.5 h-3.5"/> WSL2 NAT Bridge</div>
                    <code className="text-[11px] whitespace-pre">netsh interface portproxy add v4tov4<br/>listenport=162 listenaddress=0.0.0.0<br/>connectport=162 connectaddress=$(wsl hostname -I)</code>
                    <div className="mt-1 text-zinc-500">Agar SNMP trap masuk dari LAN ke WSL.</div>
                  </div>
                  <div className="rounded-[14px] bg-[#f8fafc] border border-zinc-200 px-4 py-3 text-zinc-700">
                    <div className="font-[600] mb-1">Tips scan cepat</div>
                    • Jalankan scanner di host bare-metal / VM bridged untuk /16.<br/>
                    • WSL: gunakan mirrored networking (Windows 11 23H2).<br/>
                    • Multi-community parallel – 15–40 dtk / /24.
                  </div>
                </div>
              </div>
            </div>
          )}

          {view==="alerts" && (
            <div className="bg-white rounded-[22px] border border-zinc-200 p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="text-[16px] font-[630]">Alert & Insiden Jaringan</div>
                <div className="flex gap-2 text-[12px]">
                  <button onClick={() => ackAllAlerts()} className="px-3 py-[7px] rounded-[10px] border border-zinc-300 hover:bg-zinc-50">Ack semua</button>
                  <button className="px-3 py-[7px] rounded-[10px] bg-zinc-900 text-white">Export CSV</button>
                </div>
              </div>
              <div className="space-y-[11px]">
                {alerts.map(a=>{
                  const d = devices.find(dd=>dd.id===a.deviceId)
                  return (
                    <div key={a.id} className={`rounded-[16px] border px-4 py-[13px] flex items-start gap-3 ${a.sev==="crit" ? "border-red-200 bg-red-50/55" : a.sev==="warn" ? "border-amber-200 bg-amber-50/55" : "border-sky-200 bg-sky-50/50"}`}>
                      <div className={`w-[8px] h-[8px] mt-[6px] rounded-full ${a.sev==="crit"?"bg-red-500":a.sev==="warn"?"bg-amber-500":"bg-sky-500"}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.4px] text-zinc-900">{a.message}</div>
                        <div className="text-[11.7px] text-zinc-600 mt-[2px]">
                          {d?.hostname} • {d?.ip} • {new Date(a.time).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <button
                        onClick={() => ackAlert(a.id, a.ack)}
                        className={`text-[11.5px] px-[10px] py-[6px] rounded-[9px] border ${a.ack ? "border-zinc-300 text-zinc-600 bg-white" : "border-zinc-900 text-white bg-zinc-900"}`}
                      >
                        {a.ack ? "Unack" : "Acknowledge"}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view==="deploy" && (
            <div className="grid grid-cols-12 gap-[16px]">
              <div className="col-span-12 xl:col-span-7 bg-white rounded-[22px] border border-zinc-200 p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                <div className="text-[16px] font-[630]">Deploy • Bare Metal / VM / WSL – Optimized</div>
                <div className="text-[12.5px] text-zinc-500 mb-4">Stack: Go 1.23 • NATS • TimescaleDB • SvelteKit UI (ini React demo)</div>
                <div className="grid md:grid-cols-3 gap-3 text-[12.5px] mb-4">
                  {[
                    {t:"Ringan", d:"< 120 MB RAM idle\n2 vCPU cukup untuk 600 node"},
                    {t:"Cepat", d:"SNMP poll 30s\nP95 API < 18ms"},
                    {t:"Scalable", d:"Horizontal poller\nNATS queue"},
                  ].map(b=>(
                    <div key={b.t} className="rounded-[14px] border border-zinc-200 bg-zinc-50/80 px-4 py-3">
                      <div className="font-[580] text-zinc-800">{b.t}</div>
                      <div className="text-zinc-600 whitespace-pre mt-1">{b.d}</div>
                    </div>
                  ))}
                </div>

                <div className="text-[13.5px] font-[600] mb-2">docker-compose.yml</div>
                <pre className="text-[11.6px] bg-[#0e1117] text-[#d5deea] rounded-[14px] p-4 overflow-auto leading-[1.55]">{`version: "3.9"
services:
  netmon-poller:
    image: ghcr.io/polije/netmon-poller:2.6
    restart: unless-stopped
    network_mode: host
    environment:
      SNMP_COMMUNITIES: "publicPolije,polijeRO,ruijieRO,unifiRO"
      UNIFI_URL: "https://10.10.1.40:8443"
      UNIFI_USER: "netmon@polije.ac.id"
      NATS_URL: "nats://nats:4222"
      POLL_INTERVAL: "30s"
    volumes:
      - ./config:/etc/netmon

  netmon-api:
    image: ghcr.io/polije/netmon-api:2.6
    ports: ["8080:8080"]
    depends_on: [timescale, nats]
    environment:
      DATABASE_URL: "postgres://netmon:secret@timescale:5432/netmon"

  ui:
    image: ghcr.io/polije/netmon-ui:2.6
    ports: ["3000:80"]

  timescale:
    image: timescale/timescaledb:latest-pg16
    volumes: [tsdata:/var/lib/postgresql/data]

  nats:
    image: nats:2
    command: ["-js"]
volumes: { tsdata: {} }`}</pre>

                <div className="flex gap-2 mt-3">
                  <button className="text-[12.5px] px-3 py-[7px] rounded-[10px] border border-zinc-300 flex items-center gap-1.5 hover:bg-zinc-50"><Download className="w-3.5 h-3.5"/> docker-compose.yml</button>
                  <button className="text-[12.5px] px-3 py-[7px] rounded-[10px] border border-zinc-300 flex items-center gap-1.5 hover:bg-zinc-50"><Download className="w-3.5 h-3.5"/> systemd unit</button>
                  <button className="text-[12.5px] px-3 py-[7px] rounded-[10px] border border-zinc-300 flex items-center gap-1.5 hover:bg-zinc-50"><Download className="w-3.5 h-3.5"/> Ansible playbook</button>
                </div>
              </div>

              <div className="col-span-12 xl:col-span-5 space-y-[16px]">
                <div className="bg-white rounded-[22px] border border-zinc-200 p-[18px] md:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.045)]">
                  <div className="text-[14.8px] font-[620] mb-2">WSL2 NAT Helper</div>
                  <pre className="text-[11.1px] bg-zinc-950 text-zinc-100 rounded-[12px] p-3 overflow-auto">{`# run as Administrator PowerShell
$WSLIP = (wsl hostname -I).Trim()
netsh interface portproxy reset
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=$WSLIP
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$WSLIP
netsh interface portproxy add v4tov4 listenport=162 listenaddress=0.0.0.0 connectport=162 connectaddress=$WSLIP
# Windows Firewall
New-NetFirewallRule -DisplayName "NetMon WSL" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080,3000,162`}</pre>
                  <div className="text-[11.8px] text-zinc-500 mt-2">Tip: aktifkan mirrored networking di .wslconfig untuk akses LAN langsung tanpa portproxy (Win 11 23H2+).</div>
                </div>

                <div className="bg-white rounded-[22px] border border-zinc-200 p-[18px] md:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.045)] text-[12.8px] text-zinc-700 leading-relaxed">
                  <div className="text-[14.5px] font-[620] text-zinc-900 mb-2">Arsitektur Ringkas</div>
                  • Poller Go, SNMP v2c/v3, UniFi API native autosync<br/>
                  • NATS JetStream queue metric<br/>
                  • TimescaleDB TS + Postgres config<br/>
                  • API Go Fiber • UI React / SvelteKit PWA<br/>
                  • Alertmanager → Telegram / Email UPT TIK<br/>
                  • Exporter Prometheus compatible<br/><br/>
                  <div className="text-[11.8px] text-zinc-500">Maintainable: 1 binary poller, helm chart, <code>.env</code> tunggal. Build CI GitHub Actions 58s.</div>
                </div>
              </div>
            </div>
          )}

          <footer className="text-center text-[11.6px] text-zinc-500 py-4">
            © 2026 UPT TIK Politeknik Negeri Jember • NetMon Polije v2.6 • Built Go + TimescaleDB • UI Apple-clean • {devices.length} nodes monitored
          </footer>
        </main>
      </div>

      {/* Device slideover */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/28" onClick={()=>setSelectedDevice(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-[430px] bg-white border-l border-zinc-200 shadow-2xl overflow-auto">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-[610]">{selectedDevice.hostname}</div>
                <div className="text-[12px] text-zinc-500">{selectedDevice.ip} • {selectedDevice.vendor} {selectedDevice.model}</div>
              </div>
              <button onClick={()=>setSelectedDevice(null)} className="p-[7px] rounded-[10px] hover:bg-zinc-100"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex gap-2 flex-wrap">
                <StatusPill status={selectedDevice.status}/>
                <span className="text-[11px] px-[9px] py-[4px] rounded-full bg-zinc-100 text-zinc-700">{selectedDevice.category.toUpperCase()}</span>
                <span className="text-[11px] px-[9px] py-[4px] rounded-full bg-zinc-100 text-zinc-700">{buildings.find(b=>b.id===selectedDevice.buildingId)?.short}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12.7px]">
                {[
                  ["CPU", selectedDevice.cpu ? `${selectedDevice.cpu.toFixed(1)}%` : "—"],
                  ["Memory", selectedDevice.mem ? `${selectedDevice.mem.toFixed(0)}%` : "—"],
                  ["Temp", selectedDevice.temp ? `${selectedDevice.temp.toFixed(0)}°C` : "—"],
                  ["Latency", selectedDevice.latencyMs ? `${selectedDevice.latencyMs.toFixed(2)} ms` : "—"],
                  ["Uptime", formatUptime(selectedDevice.uptimeSec)],
                  ["Loss", `${selectedDevice.loss.toFixed(2)}%`],
                  ["Traffic In", formatTraffic(selectedDevice.trafficInMbps)],
                  ["Traffic Out", formatTraffic(selectedDevice.trafficOutMbps)],
                ].map(([k,v])=>(
                  <div key={k} className="rounded-[14px] border border-zinc-200 px-3 py-[10px] bg-zinc-50/70">
                    <div className="text-[11px] text-zinc-500">{k}</div>
                    <div className="font-[550] text-zinc-800">{v}</div>
                  </div>
                ))}
              </div>

              {selectedDevice.clients !== undefined && (
                <div className="rounded-[14px] border border-zinc-200 px-4 py-3 bg-white">
                  <div className="text-[11.5px] text-zinc-500">Client Wi-Fi</div>
                  <div className="text-[26px] font-[640] tracking-[-0.017em]">{selectedDevice.clients}</div>
                </div>
              )}

              <div className="text-[12.6px] text-zinc-700 space-y-[6px]">
                <div><b>Lokasi:</b> {buildings.find(b=>b.id===selectedDevice.buildingId)?.name} {selectedDevice.floor ? "• "+selectedDevice.floor : ""}</div>
                <div><b>SNMP:</b> {selectedDevice.snmp ? `v2c • ${selectedDevice.snmpCommunity||"RO"}` : "non-SNMP / API"}</div>
                <div><b>Last seen:</b> {timeAgo(selectedDevice.lastSeen)} lalu</div>
                {selectedDevice.notes && <div className="text-amber-700"><b>Catatan:</b> {selectedDevice.notes}</div>}
              </div>

              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={Array.from({length:18}).map((_,i)=>({
                    x:i,
                    v: Math.max(3, selectedDevice.cpu + Math.sin(i/2)*6 + (Math.random()-0.5)*7)
                  }))}>
                    <Line type="monotone" dataKey="v" stroke="#0a84ff" strokeWidth={2} dot={false}/>
                    <XAxis dataKey="x" hide/>
                    <YAxis hide domain={[0,100]}/>
                    <RechartsTooltip formatter={(v:any)=>[`${(+v).toFixed(1)}%`, "CPU"]} labelFormatter={()=>""}/>
                  </LineChart>
                </ResponsiveContainer>
                <div className="text-[11px] text-zinc-500 text-center -mt-1">CPU 18 menit terakhir</div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 text-[12.5px] py-[9px] rounded-[12px] border border-zinc-300 hover:bg-zinc-50">Ping / Traceroute</button>
                <button className="flex-1 text-[12.5px] py-[9px] rounded-[12px] bg-zinc-900 text-white">Detail SNMP</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 1023px){
          aside{position:relative}
        }
        html,body{ background:#f5f5f7; }
      `}</style>
    </div>
  )
}

function KpiCard({label, value, sub, icon, tone}:{label:string; value:string; sub:string; icon:React.ReactNode; tone:"zinc"|"green"|"amber"|"red"|"blue"|"indigo"}){
  const tones:Record<string,string> = {
    zinc: "bg-zinc-50 text-zinc-600 border-zinc-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-600 border-red-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  }
  return (
    <div className="bg-white rounded-[18px] border border-zinc-200 px-[15px] py-[14px] shadow-[0_1px_1px_rgba(0,0,0,0.033)]">
      <div className="flex items-center justify-between mb-[7px]">
        <div className="text-[11.3px] text-zinc-500">{label}</div>
        <div className={`w-[28px] h-[28px] rounded-[9px] border flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      </div>
      <div className="text-[24px] font-[640] tracking-[-0.016em] leading-[1.05] text-zinc-900">{value}</div>
      <div className="text-[11.8px] text-zinc-500 mt-[4px]">{sub}</div>
    </div>
  )
}

function StatusPill({status}:{status:DeviceStatus}){
  const map: Record<DeviceStatus, string> = {
    online: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    offline: "bg-zinc-100 text-zinc-600 border-zinc-300",
    maintenance: "bg-indigo-50 text-indigo-700 border-indigo-200",
  }
  const label = status==="online" ? "Online" : status==="warning" ? "Warning" : status==="offline" ? "Offline" : "Maintenance"
  return <span className={`inline-flex items-center gap-[6px] text-[11.4px] font-[540] px-[10px] py-[4px] rounded-full border ${map[status]}`}><Dot className="-mx-[6px] w-5 h-5" />{label}</span>
}

function FilterSelect({label, value, onChange, options}:{label:string; value:string; onChange:(v:string)=>void; options:[string,string][]}){
  return (
    <div>
      <div className="text-[11px] text-zinc-500 mb-1">{label}</div>
      <select value={value} onChange={e=>onChange(e.target.value)} className="min-w-[150px] rounded-[12px] border border-zinc-300 px-[11px] py-[9px] text-[13.1px] bg-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/25">
        {options.map(([v,l])=> <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function LabeledInput({label, value, onChange, placeholder}:{label:string; value:string; onChange:(v:string)=>void; placeholder?:string}){
  return (
    <div>
      <div className="text-[12px] text-zinc-600 mb-[6px]">{label}</div>
      <input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="w-full rounded-[12px] border border-zinc-300 px-3 py-[9px] text-[13.3px] focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/25"/>
    </div>
  )
}