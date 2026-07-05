import XLSX from "xlsx";
import fs from "node:fs";

// Fichier Excel
const INPUT_FILE = "./BRASSE_II_BDD_2025_0_3.xlsx";
const SHEET_NAME = "BDD";
const OUTPUT_FILE = "./brasse2-data.js";

// Lecture du classeur
const workbook = XLSX.readFile(INPUT_FILE);
const sheet = workbook.Sheets[SHEET_NAME];

// Lecture en tableau (header:1 = tableau de tableaux)
const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
});

// Ligne des entêtes (ligne 3 => index 2)
const headers = rows[2];

// Données à partir de la ligne 4
const dataRows = rows.slice(3);

// Associe chaque ligne à un objet avec les noms des colonnes
const objects = dataRows
    .filter(r => r[0]) // Ignore les lignes sans ID
    .map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i];
        });

        return {
            id: obj["ID"],
            brand: obj["Marque"],
            model: obj["Modèle"],

            diameterCm: number(obj["Diamètre du BA (cm)"]),
            ceilingDistanceCm: number(obj["Distance  plafond/BA (cm)"]),
            testHeightCm: number(obj["Hauteur du BA (cm)"]),
            ratioDh: number(obj["Ratio D/h"]),

            fixation: obj["Fixation"],
            motor: obj["Moteur"],

            rpmMax: number(obj["V_Vmax (rpm)"]),
            powerMaxW: number(obj["P_Vmax (W)"]),
            lwaMinDbA: number(obj["LwA_Vmin (dBA)"]),
            lwaMaxDbA: number(obj["LwA_Vmax (dBA)"]),

            vDirAssisMax: number(obj["Vdir_assis_Vmax (m/s)"]),
            vDirDeboutMax: number(obj["Vdir_debout_Vmax (m/s)"]),
            ceDirAssisMax: number(obj["CEdir_assis_Vmax (°C)"]),
            ceDirDeboutMax: number(obj["CEdir_debout_Vmax (°C)"]),

            ventMax: number(obj["Vent_Vmax (m/s)"]),
            ceEntrMax: number(obj["CEent_Vmax (°C)"]),
            vAvgMax: number(obj["Vitesse moyenne_Vmax (m/s)"]),
            ceAvgMax: number(obj["CE moyen_Vmax (°C)"]),

        };
    });

function number(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (typeof value === "number") {
        return value;
    }

    return Number(String(value).replace(",", "."));
}

// Génération du fichier JS
const output =
`export const BRASSE2_MODELS = ${JSON.stringify(objects, null, 2)};\n`;

fs.writeFileSync(OUTPUT_FILE, output, "utf8");

console.log(`✔ ${objects.length} modèles exportés vers ${OUTPUT_FILE}`);