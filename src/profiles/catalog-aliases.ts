import type { DeviceProfile } from "./types";
// Same device-description entries in OCCU d9d7acbb37c29703f71c89cf3c1f62c390ddcfb2.
// Facts only; no manufacturer XML/artwork is distributed.
export const CATALOG_ALIASES = {
  "HmIP-HDM3": {
    base: "HmIP-HDM1",
    descriptor: "device_mod_hd.xml",
  },
  "HmIP-HDM4": {
    base: "HmIP-HDM1",
    descriptor: "device_mod_hd.xml",
  },
  "HmIP-HDM5": {
    base: "HmIP-HDM1",
    descriptor: "device_mod_hd.xml",
  },
  "HmIP-HDM6": {
    base: "HmIP-HDM1",
    descriptor: "device_mod_hd.xml",
  },
  "HmIP-HDM7": {
    base: "HmIP-HDM1",
    descriptor: "device_mod_hd.xml",
  },
  "HmIP-HDM8": {
    base: "HmIP-HDM1",
    descriptor: "device_mod_hd.xml",
  },
  "HmIP-HDM9": {
    base: "HmIP-HDM1",
    descriptor: "device_mod_hd.xml",
  },
  "HmIP-ASIR-B1": {
    base: "HmIP-ASIR",
    descriptor: "device_asir.xml",
  },
  "HmIP-BBL-2": {
    base: "HmIP-BBL",
    descriptor: "device_bbl.xml",
  },
  "HmIP-BBL-I": {
    base: "HmIP-BBL",
    descriptor: "device_bbl.xml",
  },
  "HmIP-BRC2-2": {
    base: "HmIP-BRC2",
    descriptor: "device_brc2.xml",
  },
  "HmIP-BWTH24": {
    base: "HmIP-BWTH",
    descriptor: "device_bwth.xml",
  },
  "HmIP-BWTH-A": {
    base: "HmIP-BWTH",
    descriptor: "device_bwth.xml",
  },
  "HmIP-DLD-A": {
    base: "HmIP-DLD",
    descriptor: "device_dld.xml",
  },
  "HmIP-DLD-S": {
    base: "HmIP-DLD",
    descriptor: "device_dld.xml",
  },
  "HmIP-DLP-A": {
    base: "HmIP-DLP",
    descriptor: "device_dlp.xml",
  },
  "HmIP-DLP-WS": {
    base: "HmIP-DLP",
    descriptor: "device_dlp.xml",
  },
  "HmIP-DLP-AS": {
    base: "HmIP-DLP",
    descriptor: "device_dlp.xml",
  },
  "HmIP-FAL24-C10": {
    base: "HmIP-FAL230-C10",
    descriptor: "device_fal10.xml",
  },
  "HmIP-FSI16-2": {
    base: "HmIP-FSI16",
    descriptor: "device_fsi16.xml",
  },
  "HmIPW-FAL24-C6": {
    base: "HmIPW-FAL230-C6",
    descriptor: "device_hmipw_fal6.xml",
  },
  "HmIPW-SMI55-A": {
    base: "HmIPW-SMI55",
    descriptor: "device_hmipw_smi55.xml",
  },
  "HmIPW-STHD-A": {
    base: "HmIPW-STHD",
    descriptor: "device_hmipw_sthd.xml",
  },
  "HmIPW-WRC6-A": {
    base: "HmIPW-WRC6",
    descriptor: "device_hmipw_wrc6.xml",
  },
  "HmIPW-WTH-A": {
    base: "HmIPW-WTH",
    descriptor: "device_hmipw_wth.xml",
  },
  "HmIP-KRC4-2": {
    base: "HmIP-KRC4",
    descriptor: "device_krc4.xml",
  },
  "HmIP-KRCA-2": {
    base: "HmIP-KRCA",
    descriptor: "device_krca.xml",
  },
  "HmIP-PDT-UK": {
    base: "HmIP-PDT",
    descriptor: "device_pdt.xml",
  },
  "HmIP-PDT-PE": {
    base: "HmIP-PDT",
    descriptor: "device_pdt.xml",
  },
  "HmIP-PDT-CH": {
    base: "HmIP-PDT",
    descriptor: "device_pdt.xml",
  },
  "HmIP-PDT-A": {
    base: "HmIP-PDT",
    descriptor: "device_pdt.xml",
  },
  "HmIP-PS-PE": {
    base: "HMIP-PS",
    descriptor: "device_ps.xml",
  },
  "HmIP-PS-CH": {
    base: "HMIP-PS",
    descriptor: "device_ps.xml",
  },
  "HmIP-PS-UK": {
    base: "HMIP-PS",
    descriptor: "device_ps.xml",
  },
  "HmIP-PSM-PE": {
    base: "HMIP-PSM",
    descriptor: "device_psm.xml",
  },
  "HmIP-PSM-UK": {
    base: "HMIP-PSM",
    descriptor: "device_psm.xml",
  },
  "HmIP-PSM-IT": {
    base: "HMIP-PSM",
    descriptor: "device_psm.xml",
  },
  "HmIP-PSM-CH": {
    base: "HMIP-PSM",
    descriptor: "device_psm.xml",
  },
  "HmIP-PSM-PE-2": {
    base: "HmIP-PSM-2",
    descriptor: "device_psm_2.xml",
  },
  "HmIP-PSM-CH-2": {
    base: "HmIP-PSM-2",
    descriptor: "device_psm_2.xml",
  },
  "HmIP-PSM-A": {
    base: "HmIP-PSM-2",
    descriptor: "device_psm_2.xml",
  },
  "HmIP-SMI55-2": {
    base: "HmIP-SMI55",
    descriptor: "device_smi55.xml",
  },
  "HmIP-SMI55-A": {
    base: "HmIP-SMI55",
    descriptor: "device_smi55.xml",
  },
  "HmIP-SMO-A-2": {
    base: "HmIP-SMO",
    descriptor: "device_smo.xml",
  },
  "HmIP-SMO230": {
    base: "HmIP-SMO230-A",
    descriptor: "device_smo230.xml",
  },
  "HmIP-STH-A": {
    base: "HmIP-STH",
    descriptor: "device_sth.xml",
  },
  "HmIP-STHD-A": {
    base: "HmIP-STHD",
    descriptor: "device_sthd.xml",
  },
  "HmIP-SWD-2": {
    base: "HmIP-SWD",
    descriptor: "device_swd.xml",
  },
  "HmIP-SWDM-2": {
    base: "HmIP-SWDM",
    descriptor: "device_swdm.xml",
  },
  "HmIP-SWSD-2-NL": {
    base: "HmIP-SWSD-2",
    descriptor: "device_swsd_2.xml",
  },
  "HmIP-eTRV-2-UK": {
    base: "HMIP-eTRV",
    descriptor: "device_trv.xml",
  },
  "HmIP-eTRV-B-DEV": {
    base: "HmIP-eTRV-B",
    descriptor: "device_trv_b.xml",
  },
  "HmIP-eTRV-B-UK": {
    base: "HmIP-eTRV-B",
    descriptor: "device_trv_b.xml",
  },
  "HmIP-eTRV-E-S": {
    base: "HmIP-eTRV-E",
    descriptor: "device_trv_e.xml",
  },
  "HmIP-eTRV-F-A": {
    base: "HmIP-eTRV-F",
    descriptor: "device_trv_f.xml",
  },
  "HmIP-UDI-SMI55-A": {
    base: "HmIP-UDI-SMI55",
    descriptor: "device_udi_smi55.xml",
  },
  "HmIP-WGTC-A": {
    base: "HmIP-WGTC",
    descriptor: "device_wgtc.xml",
  },
  "HmIP-WRC2-A": {
    base: "HMIP-WRC2",
    descriptor: "device_wrc2.xml",
  },
  "HmIP-WRC2-2": {
    base: "HMIP-WRC2",
    descriptor: "device_wrc2.xml",
  },
  "HmIP-WRC2-A-2": {
    base: "HMIP-WRC2",
    descriptor: "device_wrc2.xml",
  },
  "HmIP-WRC6-A": {
    base: "HmIP-WRC6",
    descriptor: "device_wrc6.xml",
  },
  "HmIP-WTH-A": {
    base: "HmIP-WTH-2",
    descriptor: "device_wth2.xml",
  },
} as const;
export function catalogAliases(
  profiles: readonly DeviceProfile[],
): DeviceProfile[] {
  return Object.entries(CATALOG_ALIASES).map(([model, { base }]) => {
    const profile = profiles.find((p) => p.deviceTypes.includes(base));
    if (!profile) throw new Error(`Missing catalog alias base: ${base}`);
    return {
      ...profile,
      id: `${model.toLowerCase()}-alias`,
      deviceTypes: [model],
    };
  });
}
