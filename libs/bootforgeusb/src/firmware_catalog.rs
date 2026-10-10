use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChipsetProfile {
    pub vendor: String,
    pub family: String,
    pub marketed_as: Vec<String>,
    pub aliases: Vec<String>,
    pub service_modes: Vec<String>,
    pub loader_kinds: Vec<String>,
    pub common_storage: Vec<String>,
    pub package_markers: Vec<String>,
    pub security_note: String,
}

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn q(
    family: &str,
    marketed_as: &[&str],
    aliases: &[&str],
    storage: &[&str],
) -> ChipsetProfile {
    ChipsetProfile {
        vendor: "qualcomm".into(),
        family: family.into(),
        marketed_as: strings(marketed_as),
        aliases: strings(aliases),
        service_modes: strings(&["fastboot", "qualcomm-edl-9008", "sahara", "firehose"]),
        loader_kinds: strings(&["OEM/service-authorized Firehose .elf/.mbn"]),
        common_storage: strings(storage),
        package_markers: strings(&[
            "rawprogram*.xml",
            "patch*.xml",
            "prog_*_firehose*.elf",
            "prog_*_firehose*.mbn",
            "gpt*.bin",
            "*.img",
            "*.mbn",
            "*.elf",
        ]),
        security_note: "Chipset match is advisory only. Secure-boot state, OEM signing, storage geometry, DDR configuration, programmer authorization, and exact device variant must independently match before any EDL write.".into(),
    }
}

fn m(
    family: &str,
    marketed_as: &[&str],
    aliases: &[&str],
    storage: &[&str],
) -> ChipsetProfile {
    ChipsetProfile {
        vendor: "mediatek".into(),
        family: family.into(),
        marketed_as: strings(marketed_as),
        aliases: strings(aliases),
        service_modes: strings(&["fastboot", "mediatek-preloader", "mediatek-brom"]),
        loader_kinds: strings(&[
            "OEM/service-authorized Download Agent",
            "OEM authentication file when required",
            "scatter manifest",
        ]),
        common_storage: strings(storage),
        package_markers: strings(&[
            "*_Android_scatter.txt",
            "preloader*.bin",
            "MTK_AllInOne_DA*.bin",
            "*.auth",
            "*.img",
            "*.bin",
        ]),
        security_note: "Chipset match is advisory only. SLA/DAA/authentication, secure boot, preloader generation, DRAM init, storage geometry, and exact board/OEM variant must independently match. BobFWTools does not use BootROM/SLA/DAA bypasses.".into(),
    }
}

pub fn chipset_catalog() -> Vec<ChipsetProfile> {
    vec![
        // Qualcomm legacy + MSM era.
        q("MSM8x10 / MSM8x12", &["Snapdragon 200/400 era"], &["msm8210", "msm8212", "msm8610", "msm8612", "msm8910"], &["emmc"]),
        q("MSM8909", &["Snapdragon 210/212"], &["msm8909", "8909"], &["emmc"]),
        q("MSM8916 / MSM8939", &["Snapdragon 410/412/415/615"], &["msm8916", "msm8939", "8916", "8939"], &["emmc"]),
        q("MSM8952 / MSM8953", &["Snapdragon 617/625/626"], &["msm8952", "msm8953", "8952", "8953"], &["emmc"]),
        q("MSM8956 / MSM8976", &["Snapdragon 650/652/653"], &["msm8956", "msm8976", "8956", "8976"], &["emmc"]),
        q("MSM8992 / MSM8994", &["Snapdragon 808/810"], &["msm8992", "msm8994", "8992", "8994"], &["emmc"]),
        q("MSM8996", &["Snapdragon 820/821"], &["msm8996", "8996"], &["emmc", "ufs"]),
        q("MSM8998", &["Snapdragon 835"], &["msm8998", "8998"], &["ufs"]),
        // Qualcomm SDM era.
        q("SDM4xx", &["Snapdragon 429/439/450/460"], &["sdm429", "sdm439", "sdm450", "sm4250"], &["emmc", "ufs"]),
        q("SDM6xx", &["Snapdragon 630/632/636/660/662/665/670/675/678"], &["sdm630", "sdm632", "sdm636", "sdm660", "sm6115", "sm6125", "sm6150", "sdm670"], &["emmc", "ufs"]),
        q("SDM7xx", &["Snapdragon 710/712/720G/730/730G/732G"], &["sdm710", "sdm712", "sm7125", "sm7150", "sm7150ac"], &["ufs"]),
        // Qualcomm SM era.
        q("SM4350 / SM4375", &["Snapdragon 480/4 Gen 1"], &["sm4350", "sm4375"], &["ufs"]),
        q("SM4450", &["Snapdragon 4 Gen 2"], &["sm4450"], &["ufs"]),
        q("SM6225", &["Snapdragon 680/685"], &["sm6225"], &["ufs"]),
        q("SM6375", &["Snapdragon 695"], &["sm6375"], &["ufs"]),
        q("SM6450", &["Snapdragon 6 Gen 1"], &["sm6450"], &["ufs"]),
        q("SM6475", &["Snapdragon 6 Gen 3"], &["sm6475"], &["ufs"]),
        q("SM7250", &["Snapdragon 765/765G/768G"], &["sm7250"], &["ufs"]),
        q("SM7225", &["Snapdragon 750G"], &["sm7225"], &["ufs"]),
        q("SM7325", &["Snapdragon 778G/778G+"], &["sm7325"], &["ufs"]),
        q("SM7350", &["Snapdragon 7 Gen 1"], &["sm7350"], &["ufs"]),
        q("SM7435 / SM7450", &["Snapdragon 7s Gen 2 / 7 Gen 1 family"], &["sm7435", "sm7450"], &["ufs"]),
        q("SM7475", &["Snapdragon 7+ Gen 2"], &["sm7475"], &["ufs"]),
        q("SM7550", &["Snapdragon 7 Gen 3"], &["sm7550"], &["ufs"]),
        q("SM7635", &["Snapdragon 7s Gen 3"], &["sm7635"], &["ufs"]),
        q("SM8150", &["Snapdragon 855/855+/860"], &["sm8150"], &["ufs"]),
        q("SM8250", &["Snapdragon 865/865+/870"], &["sm8250"], &["ufs"]),
        q("SM8350", &["Snapdragon 888/888+"], &["sm8350"], &["ufs"]),
        q("SM8450", &["Snapdragon 8 Gen 1"], &["sm8450"], &["ufs"]),
        q("SM8475", &["Snapdragon 8+ Gen 1"], &["sm8475"], &["ufs"]),
        q("SM8550", &["Snapdragon 8 Gen 2"], &["sm8550"], &["ufs"]),
        q("SM8635", &["Snapdragon 8s Gen 3"], &["sm8635"], &["ufs"]),
        q("SM8650", &["Snapdragon 8 Gen 3"], &["sm8650"], &["ufs"]),
        q("SM8750", &["Snapdragon 8 Elite"], &["sm8750"], &["ufs"]),

        // MediaTek legacy + Helio.
        m("MT6572 / MT6580 / MT6582", &["Legacy MT65xx"], &["mt6572", "mt6580", "mt6582"], &["emmc"]),
        m("MT6592", &["Legacy octa-core MT65xx"], &["mt6592"], &["emmc"]),
        m("MT6735 / MT6737 / MT6739", &["Entry LTE MT67xx"], &["mt6735", "mt6737", "mt6739"], &["emmc"]),
        m("MT6750 / MT6752 / MT6753 / MT6755", &["Helio P10/P15 generation"], &["mt6750", "mt6752", "mt6753", "mt6755", "helio p10", "helio p15"], &["emmc"]),
        m("MT6757", &["Helio P20/P25"], &["mt6757", "helio p20", "helio p25"], &["emmc"]),
        m("MT6761 / MT6762", &["Helio A22/P22"], &["mt6761", "mt6762", "helio a22", "helio p22"], &["emmc"]),
        m("MT6763 / MT6765", &["Helio P23/P35"], &["mt6763", "mt6765", "helio p23", "helio p35"], &["emmc"]),
        m("MT6768", &["Helio G70/G80/G85/P65"], &["mt6768", "helio g70", "helio g80", "helio g85", "helio p65"], &["emmc", "ufs"]),
        m("MT6771", &["Helio P60/P70"], &["mt6771", "helio p60", "helio p70"], &["emmc", "ufs"]),
        m("MT6779", &["Helio P90/G90/G90T"], &["mt6779", "helio p90", "helio g90", "helio g90t"], &["ufs"]),
        m("MT6781", &["Helio G96"], &["mt6781", "helio g96"], &["ufs"]),
        m("MT6785", &["Helio G90T/G95"], &["mt6785", "helio g95"], &["ufs"]),
        m("MT6789", &["Helio G99"], &["mt6789", "helio g99"], &["ufs"]),

        // MediaTek Dimensity.
        m("MT6833", &["Dimensity 700/720/800U/810"], &["mt6833", "dimensity 700", "dimensity 720", "dimensity 800u", "dimensity 810"], &["ufs"]),
        m("MT6835", &["Dimensity 6100+/6300"], &["mt6835", "dimensity 6100", "dimensity 6300"], &["ufs"]),
        m("MT6853", &["Dimensity 720/800U family"], &["mt6853"], &["ufs"]),
        m("MT6873", &["Dimensity 800/820"], &["mt6873", "dimensity 800", "dimensity 820"], &["ufs"]),
        m("MT6877", &["Dimensity 900/920/1080"], &["mt6877", "dimensity 900", "dimensity 920", "dimensity 1080"], &["ufs"]),
        m("MT6878", &["Dimensity 7300 family"], &["mt6878", "dimensity 7300"], &["ufs"]),
        m("MT6885 / MT6889", &["Dimensity 1000/1000+/1000L"], &["mt6885", "mt6889", "dimensity 1000"], &["ufs"]),
        m("MT6886", &["Dimensity 7200 family"], &["mt6886", "dimensity 7200"], &["ufs"]),
        m("MT6891", &["Dimensity 1100"], &["mt6891", "dimensity 1100"], &["ufs"]),
        m("MT6893", &["Dimensity 1200/1300"], &["mt6893", "dimensity 1200", "dimensity 1300"], &["ufs"]),
        m("MT6895", &["Dimensity 8100/8100-Max"], &["mt6895", "dimensity 8100"], &["ufs"]),
        m("MT6896", &["Dimensity 8200"], &["mt6896", "dimensity 8200"], &["ufs"]),
        m("MT6897", &["Dimensity 8300"], &["mt6897", "dimensity 8300"], &["ufs"]),
        m("MT6983", &["Dimensity 9000/9000+"], &["mt6983", "dimensity 9000"], &["ufs"]),
        m("MT6985", &["Dimensity 9200/9200+"], &["mt6985", "dimensity 9200"], &["ufs"]),
        m("MT6989", &["Dimensity 9300/9300+"], &["mt6989", "dimensity 9300"], &["ufs"]),
        m("MT6991", &["Dimensity 9400 family"], &["mt6991", "dimensity 9400"], &["ufs"]),

        // MediaTek tablet / Chromebook families commonly encountered in service.
        m("MT8183", &["Kompanio 500 class"], &["mt8183", "kompanio 500"], &["emmc", "ufs"]),
        m("MT8192", &["Kompanio 820 class"], &["mt8192", "kompanio 820"], &["ufs"]),
        m("MT8195", &["Kompanio 1200/1380 class"], &["mt8195", "kompanio 1200", "kompanio 1380"], &["ufs"]),
    ]
}

fn normalize(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

pub fn match_chipsets(query: &str) -> Vec<ChipsetProfile> {
    let normalized_query = normalize(query);
    if normalized_query.len() < 4 {
        return Vec::new();
    }

    let mut matches = chipset_catalog()
        .into_iter()
        .filter_map(|profile| {
            let mut score = 0usize;
            for value in profile
                .aliases
                .iter()
                .chain(profile.marketed_as.iter())
                .chain(std::iter::once(&profile.family))
            {
                let alias = normalize(value);
                if alias.len() < 4 {
                    continue;
                }
                if normalized_query == alias {
                    score = score.max(10_000 + alias.len());
                } else if normalized_query.contains(&alias) || alias.contains(&normalized_query) {
                    score = score.max(alias.len());
                }
            }
            (score > 0).then_some((score, profile))
        })
        .collect::<Vec<_>>();

    matches.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.family.cmp(&b.1.family)));
    matches.into_iter().map(|(_, profile)| profile).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_qualcomm_aliases() {
        let matches = match_chipsets("device_sm8550_global");
        assert_eq!(matches.first().map(|p| p.family.as_str()), Some("SM8550"));
        assert_eq!(matches.first().map(|p| p.vendor.as_str()), Some("qualcomm"));
    }

    #[test]
    fn resolves_mediatek_marketing_names() {
        let matches = match_chipsets("Dimensity 9300 firmware");
        assert_eq!(matches.first().map(|p| p.family.as_str()), Some("MT6989"));
        assert_eq!(matches.first().map(|p| p.vendor.as_str()), Some("mediatek"));
    }

    #[test]
    fn short_ambiguous_queries_fail_closed() {
        assert!(match_chipsets("sm8").is_empty());
        assert!(match_chipsets("mt6").is_empty());
    }

    #[test]
    fn catalog_never_claims_chipset_match_is_flash_authority() {
        for profile in chipset_catalog() {
            let note = profile.security_note.to_ascii_lowercase();
            assert!(note.contains("advisory only"));
        }
    }
}
