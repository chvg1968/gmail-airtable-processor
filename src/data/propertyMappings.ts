export interface VrboProperty {
  code: string;
  name: string;
}

export interface AirbnbProperty {
  alias: string;
  name: string;
}

export const vrboPropertyMappings: VrboProperty[] = [
  { code: "4574967", name: "2-105 Ocean Grace Villa" },
  { code: "4591129", name: "2-101 Ocean Serenity Villa" },
  { code: "4616588", name: "315 Ocean View Villa" },
  { code: "3205468", name: "3325 Villa Clara" },
  { code: "3207445", name: "10180 Villa Flora" },
  { code: "3121707", name: "7256 Villa Palacio" },
  { code: "3456633", name: "5138 Villa Paloma" },
  { code: "3131031", name: "10389 Villa Tiffany" },
  { code: "3204279", name: "Atl. G7 Casa Prestige" },
  { code: "4302592", name: "2-102 Ocean Bliss Villa" },
  { code: "4414516", name: "2-208 Ocean Haven Villa" },
  { code: "4507742", name: "2-103 Ocean Sound Villa" },
];

export const airbnbPropertyMappings: AirbnbProperty[] = [
  { alias: "Villa Clara", name: "3325 Villa Clara" },
  { alias: "Villa Palacio", name: "7256 Villa Palacio" },
  { alias: "Casa Paraiso", name: "Est. 24 Casa Paraiso" },
  { alias: "Villa Flora", name: "10180 Villa Flora" },
  { alias: "Casa Prestige", name: "Atl. G7 Casa Prestige" },
  { alias: "Villa Paloma", name: "5138 Villa Paloma" },
  { alias: "Temporal", name: "Temporal" },
  { alias: "Ocean Bliss", name: "2-102 Ocean Bliss Villa" },
  { alias: "Villa Tiffany", name: "10389 Villa Tiffany" },
  { alias: "Ocean Haven Villa", name: "2-208 Ocean Haven Villa" },
  { alias: "Ocean Sound Villa", name: "2-103 Ocean Sound Villa" },
  { alias: "Ocean Grace Villa", name: "2-105 Ocean Grace Villa" },
  { alias: "Ocean Serenity Villa", name: "2-101 Ocean Serenity Villa" },
  { alias: "Ocean View Villa", name: "315 Ocean View Villa" },
];
