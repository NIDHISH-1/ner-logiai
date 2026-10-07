/**
 * NER-LogiAI Deterministic Localization Engine
 * Supports operational multilingual communication (English & Hindi)
 * Preserves all technical values: vehicle ID, shipment ID, corridor name, ETA, delay, severity, coordinates.
 */

export type SupportedLanguage = "en" | "hi" | "as";

export interface LocalizedMessageParams {
  corridor?: string;
  roadSegment?: string;
  vehicleId?: string;
  shipmentId?: string;
  severity?: string;
  etaMinutes?: number;
  delayMinutes?: number;
  incidentId?: string;
  reason?: string;
  speed?: string;
  heading?: number;
}

export const OPERATIONAL_KEYS = {
  ROAD_BLOCKED: "ROAD_BLOCKED",
  CRITICAL_INCIDENT: "CRITICAL_INCIDENT",
  ROUTE_CHANGED: "ROUTE_CHANGED",
  NO_SAFE_ROUTE: "NO_SAFE_ROUTE",
  SHIPMENT_DELAY: "SHIPMENT_DELAY",
  GPS_STALE: "GPS_STALE",
  INCIDENT_VERIFIED: "INCIDENT_VERIFIED",
  ALERT_ACKNOWLEDGED: "ALERT_ACKNOWLEDGED",
  ALERT_RESOLVED: "ALERT_RESOLVED",
  HUMAN_IN_THE_LOOP_REQUIRED: "HUMAN_IN_THE_LOOP_REQUIRED",
  EMERGENCY_CORRIDOR_ACTIVE: "EMERGENCY_CORRIDOR_ACTIVE",
  CONVOY_AT_RISK: "CONVOY_AT_RISK",
} as const;

export type OperationalKey = keyof typeof OPERATIONAL_KEYS;

interface TranslationTemplate {
  title: (params: LocalizedMessageParams) => string;
  message: (params: LocalizedMessageParams) => string;
  driverAction?: (params: LocalizedMessageParams) => string;
}

const TEMPLATES: Record<SupportedLanguage, Record<OperationalKey, TranslationTemplate>> = {
  en: {
    ROAD_BLOCKED: {
      title: ({ corridor = "corridor" }) => `Corridor Disruption: ${corridor} Blocked`,
      message: ({ corridor = "corridor", severity = "CRITICAL", reason }) =>
        `Vehicle transit suspended along ${corridor}. Severity: ${severity}.${reason ? ` Cause: ${reason}.` : ""} Alternate routing required.`,
      driverAction: ({ corridor = "NH-37", delayMinutes = 31 }) =>
        `INCIDENT: ${corridor} BLOCKED\nSTATUS: CRITICAL\nACTION: Alternate route requires your confirmation.\nETA: +${delayMinutes} minutes`,
    },
    CRITICAL_INCIDENT: {
      title: ({ corridor = "corridor", incidentId = "" }) =>
        `Critical Incident Verified${incidentId ? ` [${incidentId}]` : ""}: ${corridor}`,
      message: ({ corridor = "corridor", severity = "CRITICAL", shipmentId }) =>
        `Emergency response priority active on ${corridor}. Severity: ${severity}.${shipmentId ? ` Priority cargo ${shipmentId} in transit.` : ""}`,
      driverAction: ({ corridor = "corridor", severity = "CRITICAL" }) =>
        `INCIDENT: ${corridor} CRITICAL HAZARD\nSTATUS: ${severity}\nACTION: Halt or await verified detour guidance.`,
    },
    ROUTE_CHANGED: {
      title: ({ vehicleId = "Vehicle", corridor = "corridor" }) =>
        `Bypass Route Recommended: ${vehicleId} (${corridor})`,
      message: ({ vehicleId = "vehicle", corridor = "corridor", delayMinutes = 0 }) =>
        `Safety-validated bypass computed for ${vehicleId} avoiding ${corridor}. Projected delay: +${delayMinutes} minutes. Requires operator confirmation.`,
      driverAction: ({ corridor = "corridor", delayMinutes = 31 }) =>
        `INCIDENT: ${corridor} RE-ROUTED\nSTATUS: CAUTION\nACTION: Confirm alternate bypass route in dashboard.\nETA: +${delayMinutes} minutes`,
    },
    NO_SAFE_ROUTE: {
      title: ({ corridor = "corridor" }) => `Transit Halted: No Safe Route (${corridor})`,
      message: ({ corridor = "corridor" }) =>
        `Safety validator evaluated all candidate corridors connecting ${corridor}. All active paths exceed acceptable risk thresholds. Hold vehicles at secure depot.`,
      driverAction: ({ corridor = "corridor" }) =>
        `INCIDENT: ALL ROUTES BLOCKED (${corridor})\nSTATUS: CRITICAL\nACTION: Pull over at nearest secure depot immediately. Await clearance.`,
    },
    SHIPMENT_DELAY: {
      title: ({ shipmentId = "Shipment", delayMinutes = 0 }) =>
        `Delay Advisory: ${shipmentId} (+${delayMinutes}m)`,
      message: ({ shipmentId = "shipment", vehicleId, delayMinutes = 0, reason }) =>
        `Shipment ${shipmentId}${vehicleId ? ` assigned to ${vehicleId}` : ""} delayed by ${delayMinutes} minutes.${reason ? ` Reason: ${reason}.` : ""}`,
      driverAction: ({ delayMinutes = 0 }) =>
        `STATUS: DELAYED\nDELAY: +${delayMinutes} minutes\nACTION: Maintain speed restrictions and report corridor checkpoints.`,
    },
    GPS_STALE: {
      title: ({ vehicleId = "Vehicle" }) => `Telemetry Alert: ${vehicleId} GPS Stale`,
      message: ({ vehicleId = "vehicle" }) =>
        `No live telemetry packet received from ${vehicleId} in over 15 minutes. Displaying last known recorded coordinates. Do not treat as live fix.`,
      driverAction: ({ vehicleId = "vehicle" }) =>
        `INCIDENT: GPS LINK INTERRUPTED (${vehicleId})\nSTATUS: WARNING\nACTION: Check satellite terminal or report location to dispatch via VHF/call.`,
    },
    INCIDENT_VERIFIED: {
      title: ({ incidentId = "Incident", corridor = "corridor" }) =>
        `Incident Verified: ${incidentId} on ${corridor}`,
      message: ({ incidentId = "incident", corridor = "corridor", severity = "HIGH" }) =>
        `Field officer report ${incidentId} confirmed on ${corridor}. Operational severity: ${severity}. Alerts propagated to affected convoys.`,
      driverAction: ({ corridor = "corridor", severity = "HIGH" }) =>
        `INCIDENT: ${corridor} CONFIRMED HAZARD\nSTATUS: ${severity}\nACTION: Exercise extreme vigilance approaching km marker.`,
    },
    ALERT_ACKNOWLEDGED: {
      title: ({ corridor = "corridor" }) => `Alert Acknowledged: ${corridor}`,
      message: ({ vehicleId, corridor = "corridor" }) =>
        `Operational warning on ${corridor} acknowledged${vehicleId ? ` for ${vehicleId}` : ""}. Audit trail logged with operator timestamp.`,
    },
    ALERT_RESOLVED: {
      title: ({ corridor = "corridor" }) => `Hazard Cleared: ${corridor}`,
      message: ({ corridor = "corridor" }) =>
        `Disruption on ${corridor} marked RESOLVED by disaster management team. Normal logistics throughput resumed.`,
    },
    HUMAN_IN_THE_LOOP_REQUIRED: {
      title: () => "Driver Confirmation Required",
      message: ({ vehicleId = "Vehicle" }) =>
        `Route redirection for ${vehicleId} requires explicit driver confirmation. Automatic vehicle redirect is disabled per safety protocol.`,
      driverAction: ({ vehicleId = "TRK-104" }) =>
        `ACTION REQUIRED: Human-in-the-loop confirmation required for ${vehicleId}.\nAutomatic redirect is disabled.`,
    },
    EMERGENCY_CORRIDOR_ACTIVE: {
      title: ({ corridor = "corridor" }) => `Emergency Priority Corridor: ${corridor}`,
      message: ({ corridor = "corridor" }) =>
        `Special relief convoy access granted on ${corridor}. Non-essential cargo diverted to bypass lanes.`,
    },
    CONVOY_AT_RISK: {
      title: ({ vehicleId = "Vehicle", corridor = "corridor" }) =>
        `Convoy at Risk: ${vehicleId} approaching ${corridor}`,
      message: ({ vehicleId = "vehicle", corridor = "corridor", severity = "CRITICAL" }) =>
        `Convoy ${vehicleId} is within hazard radius of verified disruption on ${corridor}. Severity: ${severity}.`,
      driverAction: ({ vehicleId = "TRK-104", corridor = "corridor" }) =>
        `INCIDENT: ${corridor} IN HAZARD ZONE\nVEHICLE: ${vehicleId}\nACTION: Slow down and await alternate route confirmation.`,
    },
  },
  hi: {
    ROAD_BLOCKED: {
      title: ({ corridor = "कॉरिडोर" }) => `कॉरिडोर व्यवधान: ${corridor} अवरुद्ध (BLOCKED)`,
      message: ({ corridor = "corridor", severity = "CRITICAL", reason }) =>
        `${corridor} पर वाहन पारगमन निलंबित। गंभीरता: ${severity}।${reason ? ` कारण: ${reason}।` : ""} वैकल्पिक मार्ग आवश्यक है।`,
      driverAction: ({ corridor = "NH-37", delayMinutes = 31 }) =>
        `घटना: ${corridor} अवरुद्ध (BLOCKED)\nस्थिति: गंभीर (CRITICAL)\nकार्रवाई: वैकल्पिक मार्ग के लिए आपकी पुष्टि आवश्यक है।\nETA: +${delayMinutes} मिनट`,
    },
    CRITICAL_INCIDENT: {
      title: ({ corridor = "corridor", incidentId = "" }) =>
        `गंभीर घटना सत्यापित${incidentId ? ` [${incidentId}]` : ""}: ${corridor}`,
      message: ({ corridor = "corridor", severity = "CRITICAL", shipmentId }) =>
        `${corridor} पर आपातकालीन प्रतिक्रिया सक्रिय। गंभीरता: ${severity}।${shipmentId ? ` महत्वपूर्ण सामग्री ${shipmentId} पारगमन में है।` : ""}`,
      driverAction: ({ corridor = "corridor", severity = "CRITICAL" }) =>
        `घटना: ${corridor} गंभीर जोखिम\nस्थिति: ${severity}\nकार्रवाई: रुकें अथवा सत्यापित वैकल्पिक मार्ग निर्देश की प्रतीक्षा करें।`,
    },
    ROUTE_CHANGED: {
      title: ({ vehicleId = "Vehicle", corridor = "corridor" }) =>
        `वैकल्पिक मार्ग अनुशंसित: ${vehicleId} (${corridor})`,
      message: ({ vehicleId = "vehicle", corridor = "corridor", delayMinutes = 0 }) =>
        `${corridor} से बचने के लिए ${vehicleId} हेतु सुरक्षा-सत्यापित वैकल्पिक मार्ग। अनुमानित विलंब: +${delayMinutes} मिनट। ऑपरेटर पुष्टि आवश्यक।`,
      driverAction: ({ corridor = "corridor", delayMinutes = 31 }) =>
        `घटना: ${corridor} मार्ग परिवर्तित\nस्थिति: सावधानी (CAUTION)\nकार्रवाई: डैशबोर्ड में वैकल्पिक मार्ग की पुष्टि करें।\nETA: +${delayMinutes} मिनट`,
    },
    NO_SAFE_ROUTE: {
      title: ({ corridor = "corridor" }) => `पारगमन रोका गया: कोई सुरक्षित मार्ग नहीं (${corridor})`,
      message: ({ corridor = "corridor" }) =>
        `${corridor} को जोड़ने वाले सभी वैकल्पिक मार्गों का मूल्यांकन किया गया। सभी मार्ग जोखिम सीमा से अधिक हैं। सुरक्षित डिपो पर वाहन रोकें।`,
      driverAction: ({ corridor = "corridor" }) =>
        `घटना: सभी मार्ग अवरुद्ध (${corridor})\nस्थिति: गंभीर (CRITICAL)\nकार्रवाई: तुरंत निकटतम सुरक्षित डिपो पर वाहन रोकें। मंजूरी की प्रतीक्षा करें।`,
    },
    SHIPMENT_DELAY: {
      title: ({ shipmentId = "Shipment", delayMinutes = 0 }) =>
        `विलंब सूचना: ${shipmentId} (+${delayMinutes} मिनट)`,
      message: ({ shipmentId = "shipment", vehicleId, delayMinutes = 0, reason }) =>
        `सामग्री ${shipmentId}${vehicleId ? ` (वाहन ${vehicleId})` : ""} में ${delayMinutes} मिनट का विलंब।${reason ? ` कारण: ${reason}।` : ""}`,
      driverAction: ({ delayMinutes = 0 }) =>
        `स्थिति: विलंबित (DELAYED)\nविलंब: +${delayMinutes} मिनट\nकार्रवाई: गति सीमा का पालन करें और चेकपॉइंट पर रिपोर्ट करें।`,
    },
    GPS_STALE: {
      title: ({ vehicleId = "Vehicle" }) => `टेलीमेट्री अलर्ट: ${vehicleId} जीपीएस सिग्नल पुराना`,
      message: ({ vehicleId = "vehicle" }) =>
        `${vehicleId} से 15 मिनट से कोई लाइव टेलीमेट्री प्राप्त नहीं हुई। अंतिम ज्ञात स्थिति प्रदर्शित। इसे लाइव न मानें।`,
      driverAction: ({ vehicleId = "vehicle" }) =>
        `घटना: GPS सिग्नल बाधित (${vehicleId})\nस्थिति: चेतावनी (WARNING)\nकार्रवाई: सैटेलाइट टर्मिनल जांचें या वायरलेस/कॉल पर लोकेशन बताएं।`,
    },
    INCIDENT_VERIFIED: {
      title: ({ incidentId = "Incident", corridor = "corridor" }) =>
        `घटना सत्यापित: ${incidentId} (${corridor})`,
      message: ({ incidentId = "incident", corridor = "corridor", severity = "HIGH" }) =>
        `फील्ड अधिकारी रिपोर्ट ${incidentId} की ${corridor} पर पुष्टि हुई। परिचालन गंभीरता: ${severity}। अलर्ट प्रभावित वाहनों को भेजे गए।`,
      driverAction: ({ corridor = "corridor", severity = "HIGH" }) =>
        `घटना: ${corridor} पुष्टि जोखिम\nस्थिति: ${severity}\nकार्रवाई: किलोमीटर मार्कर के समीप अत्यधिक सावधानी बरतें।`,
    },
    ALERT_ACKNOWLEDGED: {
      title: ({ corridor = "corridor" }) => `अलर्ट स्वीकृत: ${corridor}`,
      message: ({ vehicleId, corridor = "corridor" }) =>
        `${corridor} पर परिचालन चेतावनी स्वीकृत${vehicleId ? ` (${vehicleId} हेतु)` : ""}। ऑडिट लॉग में दर्ज।`,
    },
    ALERT_RESOLVED: {
      title: ({ corridor = "corridor" }) => `खतरा समाप्त: ${corridor}`,
      message: ({ corridor = "corridor" }) =>
        `${corridor} पर व्यवधान को आपदा प्रबंधन टीम द्वारा समाधान (RESOLVED) घोषित किया गया। सामान्य आवाजाही बहाल।`,
    },
    HUMAN_IN_THE_LOOP_REQUIRED: {
      title: () => "चालक पुष्टि आवश्यक",
      message: ({ vehicleId = "Vehicle" }) =>
        `${vehicleId} के मार्ग पुनर्निर्देशन के लिए स्पष्ट चालक पुष्टि आवश्यक है। सुरक्षा नीति अनुसार स्वचालित पुनर्निर्देशन अक्षम है।`,
      driverAction: ({ vehicleId = "TRK-104" }) =>
        `कार्रवाई आवश्यक: ${vehicleId} हेतु चालक की पुष्टि आवश्यक है।\nस्वचालित पुनर्निर्देशन अक्षम है।`,
    },
    EMERGENCY_CORRIDOR_ACTIVE: {
      title: ({ corridor = "corridor" }) => `आपातकालीन प्राथमिकता कॉरिडोर: ${corridor}`,
      message: ({ corridor = "corridor" }) =>
        `${corridor} पर विशेष राहत काफिला पहुंच प्रदान की गई। गैर-ज़रूरी सामग्री वैकल्पिक मार्गों पर डाइवर्ट की गई।`,
    },
    CONVOY_AT_RISK: {
      title: ({ vehicleId = "Vehicle", corridor = "corridor" }) =>
        `काफिला जोखिम में: ${vehicleId} (${corridor})`,
      message: ({ vehicleId = "vehicle", corridor = "corridor", severity = "CRITICAL" }) =>
        `काफिला ${vehicleId} ${corridor} पर सत्यापित व्यवधान के जोखिम दायरे में है। गंभीरता: ${severity}।`,
      driverAction: ({ vehicleId = "TRK-104", corridor = "corridor" }) =>
        `घटना: ${corridor} जोखिम क्षेत्र में\nवाहन: ${vehicleId}\nकार्रवाई: गति धीमी करें और वैकल्पिक मार्ग पुष्टि की प्रतीक्षा करें।`,
    },
  },
  as: {
    ROAD_BLOCKED: {
      title: ({ corridor = "কৰিডৰ" }) => `কৰিডৰ ব্যাঘাত: ${corridor} বন্ধ (BLOCKED)`,
      message: ({ corridor = "corridor", severity = "CRITICAL", reason }) =>
        `${corridor} ত বাহন চলাচল স্থগিত। গুৰুত্ব: ${severity}.${reason ? ` কাৰণ: ${reason}.` : ""} বিকল্প পথ প্ৰয়োজনীয়।`,
      driverAction: ({ corridor = "NH-37", delayMinutes = 31 }) =>
        `ঘটনা: ${corridor} বন্ধ (BLOCKED)\nস্থিতি: গুৰুতৰ (CRITICAL)\nকাৰ্য: বিকল্প পথৰ বাবে আপোনাৰ নিশ্চিতকৰণ প্ৰয়োজনীয়।\nETA: +${delayMinutes} মিনিট`,
    },
    CRITICAL_INCIDENT: {
      title: ({ corridor = "corridor", incidentId = "" }) =>
        `গুৰুত্বপূৰ্ণ ঘটনা সত্যাপিত${incidentId ? ` [${incidentId}]` : ""}: ${corridor}`,
      message: ({ corridor = "corridor", severity = "CRITICAL", shipmentId }) =>
        `${corridor} ত জৰুৰীকালীন প্ৰতিক্ৰিয়া সক্ৰিয়। গুৰুত্ব: ${severity}.${shipmentId ? ` গুৰুত্বপূৰ্ণ সামগ্ৰী ${shipmentId} যাত্ৰাৱস্থাত আছে।` : ""}`,
      driverAction: ({ corridor = "corridor", severity = "CRITICAL" }) =>
        `ঘটনা: ${corridor} গুৰুতৰ বিপদ\nস্থিতি: ${severity}\nকাৰ্য: ৰ'ব বা সত্যাপিত বিকল্প পথ নিৰ্দেশৰ অপেক্ষাত থাকক।`,
    },
    ROUTE_CHANGED: {
      title: ({ vehicleId = "Vehicle", corridor = "corridor" }) =>
        `বিকল্প পথ পৰামৰ্শকৃত: ${vehicleId} (${corridor})`,
      message: ({ vehicleId = "vehicle", corridor = "corridor", delayMinutes = 0 }) =>
        `${corridor} পৰিহাৰ কৰিবলৈ ${vehicleId} ৰ বাবে সুৰক্ষা-সত্যাপিত বিকল্প পথ। আনুমানিক বিলম্ব: +${delayMinutes} মিনিট। অপাৰেটৰ নিশ্চিতকৰণ প্ৰয়োজনীয়।`,
      driverAction: ({ corridor = "corridor", delayMinutes = 31 }) =>
        `ঘটনা: ${corridor} পথ সলনি কৰা হৈছে\nস্থিতি: সতৰ্কতা (CAUTION)\nকাৰ্য: ডেশ্বব’ৰ্ডত বিকল্প পথ নিশ্চিত কৰক।\nETA: +${delayMinutes} মিনিট`,
    },
    NO_SAFE_ROUTE: {
      title: ({ corridor = "corridor" }) => `যাত্ৰা স্থগিত: কোনো সুৰক্ষিত পথ উপলব্ধ নহয় (${corridor})`,
      message: ({ corridor = "corridor" }) =>
        `${corridor} সংযোগী সকলো পথ পৰীক্ষা কৰা হ’ল। সকলো সক্ৰিয় পথ নিৰাপত্তা সীমা পাৰ কৰিছে। সুৰক্ষিত ডিপ’ত বাহন ৰাখক।`,
      driverAction: ({ corridor = "corridor" }) =>
        `ঘটনা: সকলো পথ বন্ধ (${corridor})\nস্থিতি: গুৰুতৰ (CRITICAL)\nকাৰ্য: নিকটতম সুৰক্ষিত ডিপ’ত তৎক্ষণাৎ বাহন ৰাখক। নিৰ্দেশৰ অপেক্ষা কৰক।`,
    },
    SHIPMENT_DELAY: {
      title: ({ shipmentId = "Shipment", delayMinutes = 0 }) =>
        `বিলম্ব সতৰ্কবাণী: ${shipmentId} (+${delayMinutes}m)`,
      message: ({ shipmentId = "shipment", vehicleId, delayMinutes = 0, reason }) =>
        `চালন ${shipmentId}${vehicleId ? ` বাহন ${vehicleId} ত ন্যস্ত` : ""} ${delayMinutes} মিনিট বিলম্বিত।${reason ? ` কাৰণ: ${reason}.` : ""}`,
      driverAction: ({ delayMinutes = 0 }) =>
        `স্থিতি: বিলম্বিত (DELAYED)\nবিলম্ব: +${delayMinutes} মিনিট\nকাৰ্য: গতি নিয়ন্ত্ৰণ বজাই ৰাখক আৰু কৰিডৰ পৰীক্ষাগাৰ প্ৰতিবেদন দিয়ক।`,
    },
    GPS_STALE: {
      title: ({ vehicleId = "Vehicle" }) => `টেলিমেট্ৰী সতৰ্কবাণী: ${vehicleId} জিপিএছ নিষ্ক্ৰিয়`,
      message: ({ vehicleId = "vehicle" }) =>
        `${vehicleId} ৰ পৰা ১৫ মিনিটৰ অধিক সময় ধৰি কোনো লাইভ জিপিএছ পেকেট পোৱা নাই। শেষৰ জনাজাত স্থানাঙ্ক প্ৰদর্শন কৰা হৈছে।`,
      driverAction: ({ vehicleId = "vehicle" }) =>
        `ঘটনা: জিপিএছ সংযোগ বিচ্ছিন্ন (${vehicleId})\nস্থিতি: সতৰ্কবাণী (WARNING)\nকাৰ্য: উপগ্ৰহ টাৰ্মিনেল পৰীক্ষা কৰক বা ডিচপচত অৱস্থান জনাওক।`,
    },
    INCIDENT_VERIFIED: {
      title: ({ incidentId = "Incident", corridor = "corridor" }) =>
        `ঘটনা সত্যাপিত: ${incidentId} (${corridor})`,
      message: ({ incidentId = "incident", corridor = "corridor", severity = "HIGH" }) =>
        `ক্ষেত্ৰ বিষয়াৰ প্ৰতিবেদন ${incidentId} ${corridor} ত নিশ্চিত কৰা হ’ল। কাৰ্যনিৰ্বাহক গুৰুত্ব: ${severity}। সতৰ্কবাণী প্ৰেৰণ কৰা হৈছে।`,
      driverAction: ({ corridor = "corridor", severity = "HIGH" }) =>
        `ঘটনা: ${corridor} নিশ্চিত বিপদ\nস্থিতি: ${severity}\nকাৰ্য: কিমি মাৰ্কাৰৰ ওচৰত অতি সাৱধানতা অৱলম্বন কৰক।`,
    },
    ALERT_ACKNOWLEDGED: {
      title: ({ corridor = "corridor" }) => `সতৰ্কবাণী স্বীকাৰ কৰা হ’ল: ${corridor}`,
      message: ({ vehicleId, corridor = "corridor" }) =>
        `${corridor} ৰ কাৰ্যনিৰ্বাহক সতৰ্কবাণী স্বীকাৰ কৰা হ’ল${vehicleId ? ` (${vehicleId} ৰ বাবে)` : ""}।`,
    },
    ALERT_RESOLVED: {
      title: ({ corridor = "corridor" }) => `বিপদ মুক্ত: ${corridor}`,
      message: ({ corridor = "corridor" }) =>
        `${corridor} ৰ বিঘিনি দুৰ্যোগ ব্যৱস্থাপনা দলৰ দ্বাৰা মীমাংসা কৰা হ’ল। স্বাভাৱিক লজিষ্টিকছ পুনৰ আৰম্ভ হ’ল।`,
    },
    HUMAN_IN_THE_LOOP_REQUIRED: {
      title: () => "চালকৰ নিশ্চিতকৰণ প্ৰয়োজনীয়",
      message: ({ vehicleId = "Vehicle" }) =>
        `${vehicleId} ৰ পথ পৰিৱৰ্তনৰ বাবে চালকৰ স্পষ্ট নিশ্চিতকৰণ প্ৰয়োজনীয়। স্বয়ংক্ৰিয় পুনঃনিৰ্দেশনা নিষ্ক্ৰিয় কৰা হৈছে।`,
      driverAction: ({ vehicleId = "TRK-104" }) =>
        `কাৰ্য প্ৰয়োজনীয়: ${vehicleId} ৰ বাবে মানৱ-লুপ নিশ্চিতকৰণ প্ৰয়োজনীয়।\nস্বয়ংক্ৰিয় পুনঃনিৰ্দেশনা নিষ্ক্ৰিয়।`,
    },
    EMERGENCY_CORRIDOR_ACTIVE: {
      title: ({ corridor = "corridor" }) => `জৰুৰীকালীন অগ্ৰাধিকাৰ কৰিডৰ: ${corridor}`,
      message: ({ corridor = "corridor" }) =>
        `${corridor} ত বিশেষ সাহায্য কাফিলাৰ প্ৰৱেশ মঞ্জুৰ কৰা হৈছে।`,
    },
    CONVOY_AT_RISK: {
      title: ({ vehicleId = "Vehicle", corridor = "corridor" }) =>
        `বিপদৰ মুখত কাফিলা: ${vehicleId} (${corridor})`,
      message: ({ vehicleId = "vehicle", corridor = "corridor", severity = "CRITICAL" }) =>
        `কাফিলা ${vehicleId} ${corridor} ত সত্যাপিত বিঘিনিৰ বিপদৰ পৰিসৰৰ ভিতৰত আছে। গুৰুত্ব: ${severity}।`,
      driverAction: ({ vehicleId = "TRK-104", corridor = "corridor" }) =>
        `ঘটনা: ${corridor} বিপদজনক অঞ্চল\nবাহন: ${vehicleId}\nকাৰ্য: গতি লেহেম কৰক আৰু বিকল্প পথৰ নিশ্চিতকৰণৰ অপেক্ষা কৰক।`,
    },
  },
};

/**
 * Localize an operational alert object deterministically
 * Preserves technical IDs (TRK-*, SHP-*, NH-*, minutes, severity)
 */
export function localizeAlert(
  alert: {
    alertType?: string;
    title: string;
    message: string;
    corridor: string;
    roadSegment?: string | null;
    severity: string;
    affectedVehicleIds?: string[] | string | null;
    affectedShipmentIds?: string[] | string | null;
  },
  lang: SupportedLanguage
): { title: string; message: string; driverAction?: string; language: SupportedLanguage } {
  const getFirstId = (ids?: string[] | string | null): string | undefined => {
    if (!ids) return undefined;
    if (Array.isArray(ids)) return ids[0]?.trim();
    if (typeof ids === "string") return ids.split(",")[0]?.trim();
    return undefined;
  };

  const vehicleId = getFirstId(alert.affectedVehicleIds);
  const shipmentId = getFirstId(alert.affectedShipmentIds);

  if (lang === "en") {
    // Return structured English presentation
    const typeKey = (alert.alertType?.toUpperCase() || "") as OperationalKey;
    const template = TEMPLATES.en[typeKey];
    if (template) {
      const params: LocalizedMessageParams = {
        corridor: alert.corridor,
        roadSegment: alert.roadSegment ?? undefined,
        vehicleId,
        shipmentId,
        severity: alert.severity,
      };
      return {
        title: template.title(params),
        message: alert.message || template.message(params),
        driverAction: template.driverAction ? template.driverAction(params) : undefined,
        language: "en",
      };
    }
    return {
      title: alert.title,
      message: alert.message,
      language: "en",
    };
  }

  if (lang === "as") {
    const typeKey = (alert.alertType?.toUpperCase() || "") as OperationalKey;
    const template = TEMPLATES.as[typeKey];
    const params: LocalizedMessageParams = {
      corridor: alert.corridor,
      roadSegment: alert.roadSegment ?? undefined,
      vehicleId,
      shipmentId,
      severity: alert.severity,
    };
    if (template) {
      return {
        title: template.title(params),
        message: alert.message || template.message(params),
        driverAction: template.driverAction ? template.driverAction(params) : undefined,
        language: "as",
      };
    }
    return {
      title: alert.title,
      message: alert.message,
      language: "as",
    };
  }

  // Hindi localization
  const typeKey = (alert.alertType?.toUpperCase() || "") as OperationalKey;
  const template = TEMPLATES.hi[typeKey];
  const params: LocalizedMessageParams = {
    corridor: alert.corridor,
    roadSegment: alert.roadSegment ?? undefined,
    vehicleId,
    shipmentId,
    severity: alert.severity,
  };

  if (template) {
    return {
      title: template.title(params),
      message: template.message(params),
      driverAction: template.driverAction ? template.driverAction(params) : undefined,
      language: "hi",
    };
  }

  // Fallback: translate common phrases while keeping technical IDs
  let hiTitle = (alert.title || "")
    .replace(/Corridor Disruption/gi, "कॉरिडोर व्यवधान")
    .replace(/Blocked/gi, "अवरुद्ध (BLOCKED)")
    .replace(/Warning/gi, "चेतावनी")
    .replace(/Critical/gi, "गंभीर (CRITICAL)")
    .replace(/Verified/gi, "सत्यापित");

  let hiMessage = (alert.message || "")
    .replace(/Vehicle transit suspended/gi, "वाहन पारगमन निलंबित")
    .replace(/Severity:/gi, "गंभीरता:")
    .replace(/Alternate routing required/gi, "वैकल्पिक मार्ग आवश्यक है")
    .replace(/Flash Flood/gi, "अचानक बाढ़")
    .replace(/Mudslide/gi, "भूस्खलन")
    .replace(/Heavy transport restricted/gi, "भारी वाहनों का प्रवेश प्रतिबंधित");

  return {
    title: hiTitle,
    message: hiMessage,
    language: "hi",
  };
}

/**
 * Format a concise, actionable driver-targeted alert
 */
export function formatActionableDriverAlert(
  params: {
    corridor: string;
    status: "BLOCKED" | "CRITICAL" | "RESTRICTED" | "CAUTION";
    severity: "CRITICAL" | "HIGH" | "ADVISORY";
    delayMinutes?: number;
    actionRequired?: string;
  },
  lang: SupportedLanguage = "en"
): string {
  const { corridor, status, severity, delayMinutes = 31 } = params;
  if (lang === "hi") {
    return [
      `घटना: ${corridor} ${status === "BLOCKED" ? "अवरुद्ध (BLOCKED)" : status}`,
      `स्थिति: ${severity === "CRITICAL" ? "अति गंभीर (CRITICAL)" : "सावधानी (CAUTION)"}`,
      `कार्रवाई: वैकल्पिक मार्ग हेतु आपकी पुष्टि आवश्यक है।`,
      `ETA: +${delayMinutes} मिनट`,
    ].join("\n");
  }

  if (lang === "as") {
    return [
      `ঘটনা: ${corridor} ${status === "BLOCKED" ? "বন্ধ (BLOCKED)" : status}`,
      `স্থিতি: ${severity === "CRITICAL" ? "গুৰুতৰ (CRITICAL)" : "সতৰ্কতা (CAUTION)"}`,
      `কাৰ্য: বিকল্প পথৰ বাবে আপোনাৰ নিশ্চিতকৰণ প্ৰয়োজনীয়।`,
      `ETA: +${delayMinutes} মিনিট`,
    ].join("\n");
  }

  return [
    `INCIDENT: ${corridor} ${status}`,
    `STATUS: ${severity}`,
    `ACTION: Alternate route requires your confirmation.`,
    `ETA: +${delayMinutes} minutes`,
  ].join("\n");
}

/**
 * Common field operational UI labels
 */
export const FIELD_UI_LABELS = {
  en: {
    online: "ONLINE",
    offline: "OFFLINE",
    lastSync: "LAST SYNC",
    pendingActions: "ACTIONS PENDING",
    syncDraft: "DRAFT",
    syncPending: "PENDING SYNC",
    syncSyncing: "SYNCING",
    syncSynced: "SYNCED",
    syncFailed: "FAILED",
    syncConflict: "CONFLICT",
    roadAccessible: "ACCESSIBLE",
    roadRestricted: "RESTRICTED",
    roadBlocked: "BLOCKED",
    priorityCritical: "CRITICAL",
    priorityHigh: "HIGH",
    priorityNormal: "NORMAL",
    humanInTheLoopNotice: "Human-in-the-loop confirmed. Automatic vehicle redirect is disabled.",
    languageSelector: "Language / भाषा",
    verificationState: "Verification State",
    syncState: "Sync State",
    incidentType: "Incident Type",
    severity: "Severity",
    accessibility: "Road Accessibility",
    affectedCorridor: "Affected Corridor",
    description: "Description",
    coordinates: "Coordinates",
    acknowledge: "Acknowledge",
    assignedVehicle: "ASSIGNED VEHICLE",
    safeExecution: "Safe execution of your assigned delivery",
    driverAdvisory: "TRUCK DRIVER OPERATIONAL ADVISORY",
    humanConfirmationRequired: "HUMAN CONFIRMATION REQUIRED",
    incident: "INCIDENT",
    status: "STATUS",
    action: "ACTION",
    alternateRouteRequired: "Alternate route requires your confirmation.",
    safetyConstraintNotice: "Automatic vehicle redirect is disabled under Tier-1 safety constraints. Driver confirmation is strictly enforced.",
    emergencyShipment: "Emergency shipment",
    inTransit: "IN TRANSIT",
    currentEta: "CURRENT ETA",
    corridor: "CORRIDOR",
    telemetry: "TELEMETRY",
    recommendedAlternate: "Recommended alternate",
    longerRouteSafer: "Longer route selected because it is safer",
    lowRisk: "LOW RISK",
    myTrip: "My Trip",
    navigation: "Navigation",
    vehicleGps: "Vehicle / GPS",
    shipments: "Shipments",
    alerts: "Alerts",
    reportIncident: "Report Incident",
    offlineSync: "Offline Sync",
    settings: "Settings",
    rbacVerified: "RBAC Verified",
    safetyValidatorActive: "Safety validator & human-in-the-loop active.",
  },
  hi: {
    online: "ऑनलाइन (ONLINE)",
    offline: "ऑफ़लाइन (OFFLINE)",
    lastSync: "अंतिम सिंक (LAST SYNC)",
    pendingActions: "लंबित कार्रवाइयां (ACTIONS PENDING)",
    syncDraft: "प्रारूप (DRAFT)",
    syncPending: "सिंक लंबित (PENDING SYNC)",
    syncSyncing: "सिंक हो रहा है (SYNCING)",
    syncSynced: "सिंक संपन्न (SYNCED)",
    syncFailed: "विफल (FAILED)",
    syncConflict: "विरोधाभास (CONFLICT)",
    roadAccessible: "सुलभ (ACCESSIBLE)",
    roadRestricted: "प्रतिबंधित (RESTRICTED)",
    roadBlocked: "अवरुद्ध (BLOCKED)",
    priorityCritical: "गंभीर (CRITICAL)",
    priorityHigh: "उच्च (HIGH)",
    priorityNormal: "सामान्य (NORMAL)",
    humanInTheLoopNotice: "चालक पुष्टि सक्रिय। स्वचालित पुनर्निर्देशन अक्षम है।",
    languageSelector: "भाषा / Language",
    verificationState: "सत्यापन स्थिति",
    syncState: "सिंक स्थिति",
    incidentType: "घटना प्रकार",
    severity: "गंभीरता",
    accessibility: "मार्ग सुगम्यता",
    affectedCorridor: "प्रभावित कॉरिडोर",
    description: "विवरण",
    coordinates: "निर्देशांक",
    acknowledge: "पुष्टि करें",
    assignedVehicle: "आवंटित वाहन",
    safeExecution: "आपकी आवंटित डिलीवरी का सुरक्षित निष्पादन",
    driverAdvisory: "चालक परिचालन चेतावनी",
    humanConfirmationRequired: "मानव पुष्टि अनिवार्य",
    incident: "घटना",
    status: "स्थिति",
    action: "कार्रवाई",
    alternateRouteRequired: "वैकल्पिक मार्ग के लिए आपकी पुष्टि आवश्यक है।",
    safetyConstraintNotice: "सुरक्षा प्रोटोकॉल के तहत वाहन स्वचालित रूप से पुनर्निर्देशित नहीं किया जाएगा। ड्राइवर द्वारा स्वीकृति के बाद ही मार्ग अपडेट होगा।",
    emergencyShipment: "आपातकालीन शिपमेंट",
    inTransit: "पारगमन में",
    currentEta: "वर्तमान ईटीए",
    corridor: "कॉरिडोर",
    telemetry: "टेलीमेट्री",
    recommendedAlternate: "अनुशंसित वैकल्पिक मार्ग",
    longerRouteSafer: "अधिक सुरक्षित होने के कारण लंबा मार्ग चुना गया",
    lowRisk: "कम जोखिम",
    myTrip: "मेरी यात्रा",
    navigation: "नेविगेशन",
    vehicleGps: "वाहन / GPS",
    shipments: "शिपमेंट्स",
    alerts: "अलर्ट",
    reportIncident: "घटना रिपोर्ट करें",
    offlineSync: "ऑफ़लाइन सिंक",
    settings: "सेटिंग्स",
    rbacVerified: "आरबीएसी सत्यापित",
    safetyValidatorActive: "सुरक्षा वेलिडेटर और ह्यूमन-इन-द-लूप सक्रिय।",
  },
  as: {
    online: "অনলাইন (ONLINE)",
    offline: "অফলাইন (OFFLINE)",
    lastSync: "শেষ চিংক (LAST SYNC)",
    pendingActions: "বাকী থকা কাৰ্য (ACTIONS PENDING)",
    syncDraft: "ড্ৰাফ্ট (DRAFT)",
    syncPending: "চিংক বাকী (PENDING SYNC)",
    syncSyncing: "চিংক হৈ আছে (SYNCING)",
    syncSynced: "চিংক সম্পন্ন (SYNCED)",
    syncFailed: "বিফল (FAILED)",
    syncConflict: "দ্বন্দ্ব (CONFLICT)",
    roadAccessible: "চলচলাচল উপযোগী (ACCESSIBLE)",
    roadRestricted: "সংৰক্ষিত / প্ৰতিবন্ধিত (RESTRICTED)",
    roadBlocked: "অৱৰুদ্ধ (BLOCKED)",
    priorityCritical: "অতি গুৰুত্বপূৰ্ণ (CRITICAL)",
    priorityHigh: "উচ্চ (HIGH)",
    priorityNormal: "সাধাৰণ (NORMAL)",
    humanInTheLoopNotice: "মানৱ-লুপ নিশ্চিতকৰণ সম্পন্ন। স্বয়ংক্ৰিয় বাহন পুনঃনিৰ্দেশনা নিষ্ক্ৰিয়।",
    languageSelector: "ভাষা / Language",
    verificationState: "সত্যাপন স্থিতি",
    syncState: "চিংক স্থিতি",
    incidentType: "ঘটনাৰ প্ৰকাৰ",
    severity: "গুৰুত্ব",
    accessibility: "পথ চলচলাচল ক্ষমতা",
    affectedCorridor: "প্ৰভাৱিত কৰিডৰ",
    description: "বিৱৰণ",
    coordinates: "স্থানাঙ্ক",
    acknowledge: "স্বীকাৰ কৰক",
    assignedVehicle: "আবণ্টিত বাহন",
    safeExecution: "আপোনাৰ আবণ্টিত ডেলিভাৰীৰ নিৰাপদ পৰিচালনা",
    driverAdvisory: "চালকৰ কাৰ্যকৰী পৰামৰ্শ",
    humanConfirmationRequired: "মানৱীয় নিশ্চিতকৰণ আৱশ্যক",
    incident: "ঘটনা",
    status: "স্থিতি",
    action: "পদক্ষেপ",
    alternateRouteRequired: "বিকল্প পথৰ বাবে আপোনাৰ নিশ্চিতকৰণ প্ৰয়োজনীয়।",
    safetyConstraintNotice: "সুৰক্ষা নিয়মাৱলী অনুসৰি স্বয়ংক্ৰিয় বাহন পুনঃনিৰ্দেশনা নিষ্ক্ৰিয়। চালকৰ নিশ্চিতকৰণ বাধ্যতামূলক।",
    emergencyShipment: "জৰুৰী চালান",
    inTransit: "যাত্ৰাৱস্থাত",
    currentEta: "বৰ্তমান ETA",
    corridor: "কৰিডৰ",
    telemetry: "টেলিমেট্ৰি",
    recommendedAlternate: "পৰামৰ্শিত বিকল্প পথ",
    longerRouteSafer: "অধিক সুৰক্ষিত হোৱাৰ বাবে দীঘলীয়া পথ নিৰ্বাচন কৰা হৈছে",
    lowRisk: "কম বিপদাশংকা",
    myTrip: "মোৰ যাত্ৰা",
    navigation: "দিশনিৰ্দেশনা",
    vehicleGps: "বাহন / GPS",
    shipments: "চালানসমূহ",
    alerts: "সতৰ্কবাৰ্তা",
    reportIncident: "ঘটনা প্ৰতিবেদন কৰক",
    offlineSync: "অফলাইন সমন্বয়",
    settings: "ছেটিংছ",
    rbacVerified: "RBAC সত্যাপিত",
    safetyValidatorActive: "নিৰাপত্তা ভে্লিডেতৰ আৰু মানৱ-লুপ সক্ৰিয়।",
  },
};
