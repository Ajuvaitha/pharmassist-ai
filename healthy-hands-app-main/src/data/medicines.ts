export type MedicineForm = "Tablet" | "Syrup" | "Capsule" | "Injection";

export interface MedicineRecord {
  id: string;
  genericName: string;
  brandNames: string[];
  strength: string[];
  form: MedicineForm;
  category: string;
}

/** Legacy-friendly shape: derived aliases so existing screens keep working. */
export interface Medicine extends MedicineRecord {
  name: string;
  brand: string;
  strengths: string[];
}

const RAW: MedicineRecord[] = [
  // ── Antibiotics ────────────────────────────────────────────────────────────
  { id: "ab1", genericName: "Amoxicillin", brandNames: ["Mox", "Novamox", "Amoxil"], strength: ["250mg", "500mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab2", genericName: "Amoxicillin + Clavulanic Acid", brandNames: ["Augmentin", "Clavam", "Moxikind-CV"], strength: ["375mg", "625mg", "1g"], form: "Tablet", category: "Antibiotic" },
  { id: "ab3", genericName: "Ampicillin", brandNames: ["Roscillin", "Biocillin"], strength: ["250mg", "500mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab4", genericName: "Azithromycin", brandNames: ["Azithral", "Azee", "Zithromax"], strength: ["250mg", "500mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab5", genericName: "Clarithromycin", brandNames: ["Claribid", "Crixan"], strength: ["250mg", "500mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab6", genericName: "Cefixime", brandNames: ["Taxim-O", "Zifi", "Mahacef"], strength: ["100mg", "200mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab7", genericName: "Cefuroxime", brandNames: ["Ceftum", "Supacef"], strength: ["250mg", "500mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab8", genericName: "Cefpodoxime", brandNames: ["Cepodem", "Monocef-O"], strength: ["100mg", "200mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab9", genericName: "Ceftriaxone", brandNames: ["Monocef", "Rocephin"], strength: ["250mg", "500mg", "1g"], form: "Injection", category: "Antibiotic" },
  { id: "ab10", genericName: "Cephalexin", brandNames: ["Sporidex", "Phexin"], strength: ["250mg", "500mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab11", genericName: "Ciprofloxacin", brandNames: ["Ciplox", "Cifran"], strength: ["250mg", "500mg", "750mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab12", genericName: "Levofloxacin", brandNames: ["Levoflox", "Levotas"], strength: ["250mg", "500mg", "750mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab13", genericName: "Ofloxacin", brandNames: ["Oflox", "Zanocin"], strength: ["200mg", "400mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab14", genericName: "Ofloxacin + Ornidazole", brandNames: ["O2", "Zanocin-OZ"], strength: ["200mg/500mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab15", genericName: "Norfloxacin", brandNames: ["Norflox", "Uroflox"], strength: ["200mg", "400mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab16", genericName: "Doxycycline", brandNames: ["Doxt", "Doxy-1", "Vibramycin"], strength: ["100mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab17", genericName: "Minocycline", brandNames: ["Cynomycin"], strength: ["50mg", "100mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab18", genericName: "Metronidazole", brandNames: ["Flagyl", "Metrogyl"], strength: ["200mg", "400mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab19", genericName: "Tinidazole", brandNames: ["Tiniba", "Fasigyn"], strength: ["300mg", "500mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab20", genericName: "Ornidazole", brandNames: ["Ornof", "Dazolic"], strength: ["500mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab21", genericName: "Cotrimoxazole", brandNames: ["Septran", "Bactrim"], strength: ["480mg", "960mg"], form: "Tablet", category: "Antibiotic" },
  { id: "ab22", genericName: "Clindamycin", brandNames: ["Dalacin C", "Clincin"], strength: ["150mg", "300mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab23", genericName: "Nitrofurantoin", brandNames: ["Niftran", "Martifur"], strength: ["50mg", "100mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab24", genericName: "Rifampicin", brandNames: ["Rcin", "Rifadin"], strength: ["150mg", "450mg", "600mg"], form: "Capsule", category: "Antibiotic" },
  { id: "ab25", genericName: "Amoxicillin Suspension", brandNames: ["Mox Kid", "Novamox DS"], strength: ["125mg/5ml", "250mg/5ml"], form: "Syrup", category: "Antibiotic" },
  { id: "ab26", genericName: "Azithromycin Suspension", brandNames: ["Azee Kid", "Azithral Liquid"], strength: ["100mg/5ml", "200mg/5ml"], form: "Syrup", category: "Antibiotic" },
  { id: "ab27", genericName: "Fluconazole", brandNames: ["Forcan", "Zocon"], strength: ["50mg", "150mg", "200mg"], form: "Tablet", category: "Antifungal" },
  { id: "ab28", genericName: "Itraconazole", brandNames: ["Itaspor", "Candiforce"], strength: ["100mg", "200mg"], form: "Capsule", category: "Antifungal" },
  { id: "ab29", genericName: "Terbinafine", brandNames: ["Terbicip", "Lamisil"], strength: ["250mg"], form: "Tablet", category: "Antifungal" },
  { id: "ab30", genericName: "Griseofulvin", brandNames: ["Grisovin FP"], strength: ["125mg", "250mg"], form: "Tablet", category: "Antifungal" },
  { id: "ab31", genericName: "Acyclovir", brandNames: ["Zovirax", "Acivir"], strength: ["200mg", "400mg", "800mg"], form: "Tablet", category: "Antiviral" },
  { id: "ab32", genericName: "Valacyclovir", brandNames: ["Valcivir"], strength: ["500mg", "1g"], form: "Tablet", category: "Antiviral" },
  { id: "ab33", genericName: "Oseltamivir", brandNames: ["Tamiflu", "Fluvir"], strength: ["30mg", "75mg"], form: "Capsule", category: "Antiviral" },
  { id: "ab34", genericName: "Albendazole", brandNames: ["Zentel", "Bandy"], strength: ["400mg"], form: "Tablet", category: "Antiparasitic" },
  { id: "ab35", genericName: "Ivermectin", brandNames: ["Ivermectol"], strength: ["6mg", "12mg"], form: "Tablet", category: "Antiparasitic" },
  { id: "ab36", genericName: "Hydroxychloroquine", brandNames: ["HCQS", "Zyq"], strength: ["200mg", "400mg"], form: "Tablet", category: "Antimalarial" },
  { id: "ab37", genericName: "Artemether + Lumefantrine", brandNames: ["Lumether", "Coartem"], strength: ["20mg/120mg", "80mg/480mg"], form: "Tablet", category: "Antimalarial" },

  // ── Painkillers / antipyretics ─────────────────────────────────────────────
  { id: "pn1", genericName: "Paracetamol", brandNames: ["Dolo 650", "Crocin", "Calpol", "Pacimol"], strength: ["500mg", "650mg", "1000mg"], form: "Tablet", category: "Analgesic / Antipyretic" },
  { id: "pn2", genericName: "Paracetamol Suspension", brandNames: ["Crocin Kids", "Calpol Syrup", "P-125"], strength: ["120mg/5ml", "250mg/5ml"], form: "Syrup", category: "Analgesic / Antipyretic" },
  { id: "pn3", genericName: "Ibuprofen", brandNames: ["Brufen", "Combiflam", "Ibugesic"], strength: ["200mg", "400mg", "600mg"], form: "Tablet", category: "NSAID" },
  { id: "pn4", genericName: "Ibuprofen + Paracetamol", brandNames: ["Combiflam", "Flexon"], strength: ["400mg/325mg"], form: "Tablet", category: "NSAID" },
  { id: "pn5", genericName: "Diclofenac Sodium", brandNames: ["Voveran", "Dynapar", "Voltaren"], strength: ["50mg", "75mg", "100mg"], form: "Tablet", category: "NSAID" },
  { id: "pn6", genericName: "Aceclofenac", brandNames: ["Zerodol", "Hifenac"], strength: ["100mg"], form: "Tablet", category: "NSAID" },
  { id: "pn7", genericName: "Aceclofenac + Paracetamol", brandNames: ["Zerodol-P", "Hifenac-P"], strength: ["100mg/325mg"], form: "Tablet", category: "NSAID" },
  { id: "pn8", genericName: "Naproxen", brandNames: ["Naprosyn", "Xenobid"], strength: ["250mg", "500mg"], form: "Tablet", category: "NSAID" },
  { id: "pn9", genericName: "Etoricoxib", brandNames: ["Etoshine", "Nucoxia"], strength: ["60mg", "90mg", "120mg"], form: "Tablet", category: "NSAID" },
  { id: "pn10", genericName: "Mefenamic Acid", brandNames: ["Meftal", "Meftal Spas"], strength: ["250mg", "500mg"], form: "Tablet", category: "NSAID" },
  { id: "pn11", genericName: "Nimesulide", brandNames: ["Nise", "Nimulid"], strength: ["100mg"], form: "Tablet", category: "NSAID" },
  { id: "pn12", genericName: "Tramadol", brandNames: ["Ultracet", "Tramazac"], strength: ["50mg", "100mg"], form: "Capsule", category: "Opioid analgesic" },
  { id: "pn13", genericName: "Aspirin", brandNames: ["Ecosprin", "Disprin"], strength: ["75mg", "150mg", "325mg"], form: "Tablet", category: "Antiplatelet / Analgesic" },
  { id: "pn14", genericName: "Drotaverine", brandNames: ["Drotin", "Doverin"], strength: ["40mg", "80mg"], form: "Tablet", category: "Antispasmodic" },
  { id: "pn15", genericName: "Dicyclomine", brandNames: ["Cyclopam", "Colimex"], strength: ["10mg", "20mg"], form: "Tablet", category: "Antispasmodic" },
  { id: "pn16", genericName: "Thiocolchicoside + Aceclofenac", brandNames: ["Myoril Plus", "Zerodol-MR"], strength: ["4mg/100mg"], form: "Tablet", category: "Muscle relaxant" },
  { id: "pn17", genericName: "Chlorzoxazone", brandNames: ["Myospaz", "Relaxyl"], strength: ["250mg", "500mg"], form: "Tablet", category: "Muscle relaxant" },
  { id: "pn18", genericName: "Sumatriptan", brandNames: ["Suminat", "Imitrex"], strength: ["25mg", "50mg", "100mg"], form: "Tablet", category: "Antimigraine" },
  { id: "pn19", genericName: "Diclofenac Injection", brandNames: ["Voveran Amp", "Dynapar AQ"], strength: ["75mg/3ml"], form: "Injection", category: "NSAID" },

  // ── Gastro / antacids ──────────────────────────────────────────────────────
  { id: "ga1", genericName: "Pantoprazole", brandNames: ["Pantocid", "Pan 40", "Pantop"], strength: ["20mg", "40mg"], form: "Tablet", category: "Antacid / PPI" },
  { id: "ga2", genericName: "Omeprazole", brandNames: ["Omez", "Ocid"], strength: ["10mg", "20mg", "40mg"], form: "Capsule", category: "Antacid / PPI" },
  { id: "ga3", genericName: "Esomeprazole", brandNames: ["Nexpro", "Sompraz"], strength: ["20mg", "40mg"], form: "Tablet", category: "Antacid / PPI" },
  { id: "ga4", genericName: "Rabeprazole", brandNames: ["Razo", "Rablet"], strength: ["10mg", "20mg"], form: "Tablet", category: "Antacid / PPI" },
  { id: "ga5", genericName: "Rabeprazole + Domperidone", brandNames: ["Razo-D", "Rablet-D"], strength: ["20mg/30mg"], form: "Capsule", category: "Antacid / PPI" },
  { id: "ga6", genericName: "Ranitidine", brandNames: ["Zinetac", "Rantac"], strength: ["150mg", "300mg"], form: "Tablet", category: "Antacid / H2 blocker" },
  { id: "ga7", genericName: "Famotidine", brandNames: ["Famocid", "Topcid"], strength: ["20mg", "40mg"], form: "Tablet", category: "Antacid / H2 blocker" },
  { id: "ga8", genericName: "Sucralfate", brandNames: ["Sucral", "Sucrafil"], strength: ["1g/10ml"], form: "Syrup", category: "Gastro" },
  { id: "ga9", genericName: "Antacid Gel (Magaldrate + Simethicone)", brandNames: ["Digene", "Gelusil"], strength: ["10ml", "170ml"], form: "Syrup", category: "Antacid" },
  { id: "ga10", genericName: "Domperidone", brandNames: ["Domstal", "Vomistop"], strength: ["10mg"], form: "Tablet", category: "Prokinetic" },
  { id: "ga11", genericName: "Ondansetron", brandNames: ["Emeset", "Vomikind", "Zofran"], strength: ["4mg", "8mg"], form: "Tablet", category: "Antiemetic" },
  { id: "ga12", genericName: "Metoclopramide", brandNames: ["Perinorm", "Reglan"], strength: ["10mg"], form: "Tablet", category: "Antiemetic" },
  { id: "ga13", genericName: "Lactulose", brandNames: ["Duphalac", "Looz"], strength: ["10g/15ml"], form: "Syrup", category: "Laxative" },
  { id: "ga14", genericName: "Bisacodyl", brandNames: ["Dulcolax", "Bisolax"], strength: ["5mg", "10mg"], form: "Tablet", category: "Laxative" },
  { id: "ga15", genericName: "Isabgol Husk", brandNames: ["Naturolax", "Sat-Isabgol"], strength: ["3.5g"], form: "Syrup", category: "Laxative" },
  { id: "ga16", genericName: "Racecadotril", brandNames: ["Redotil", "Zedott"], strength: ["100mg"], form: "Capsule", category: "Antidiarrhoeal" },
  { id: "ga17", genericName: "Loperamide", brandNames: ["Eldoper", "Imodium"], strength: ["2mg"], form: "Capsule", category: "Antidiarrhoeal" },
  { id: "ga18", genericName: "ORS Powder", brandNames: ["Electral", "Enerzal"], strength: ["21.8g sachet"], form: "Syrup", category: "Rehydration" },
  { id: "ga19", genericName: "Saccharomyces boulardii", brandNames: ["Econorm", "Darolac"], strength: ["250mg"], form: "Capsule", category: "Probiotic" },
  { id: "ga20", genericName: "Ursodeoxycholic Acid", brandNames: ["Udiliv", "Ursocol"], strength: ["150mg", "300mg"], form: "Tablet", category: "Hepatic" },

  // ── Antihistamines / allergy ───────────────────────────────────────────────
  { id: "al1", genericName: "Cetirizine", brandNames: ["Cetzine", "Alerid", "Okacet"], strength: ["5mg", "10mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al2", genericName: "Levocetirizine", brandNames: ["Levocet", "Xyzal", "1-Al"], strength: ["5mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al3", genericName: "Fexofenadine", brandNames: ["Allegra", "Fexova"], strength: ["120mg", "180mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al4", genericName: "Loratadine", brandNames: ["Lorfast", "Claritin"], strength: ["10mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al5", genericName: "Desloratadine", brandNames: ["Deslor", "Clarinex"], strength: ["5mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al6", genericName: "Chlorpheniramine Maleate", brandNames: ["CPM", "Piriton"], strength: ["4mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al7", genericName: "Hydroxyzine", brandNames: ["Atarax"], strength: ["10mg", "25mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al8", genericName: "Ebastine", brandNames: ["Ebast", "Ebastel"], strength: ["10mg", "20mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al9", genericName: "Bilastine", brandNames: ["Bilagen", "Blisto"], strength: ["20mg"], form: "Tablet", category: "Antihistamine / Allergy" },
  { id: "al10", genericName: "Montelukast", brandNames: ["Montair", "Montek"], strength: ["4mg", "5mg", "10mg"], form: "Tablet", category: "Anti-asthmatic" },
  { id: "al11", genericName: "Montelukast + Levocetirizine", brandNames: ["Montair-LC", "Montek-LC"], strength: ["10mg/5mg"], form: "Tablet", category: "Anti-asthmatic" },
  { id: "al12", genericName: "Cetirizine Syrup", brandNames: ["Alerid Syrup", "Cetzine Syrup"], strength: ["5mg/5ml"], form: "Syrup", category: "Antihistamine / Allergy" },

  // ── Cough & cold / respiratory ─────────────────────────────────────────────
  { id: "cc1", genericName: "Dextromethorphan", brandNames: ["Benadryl DR", "Tossex"], strength: ["10mg/5ml"], form: "Syrup", category: "Cough & Cold" },
  { id: "cc2", genericName: "Ambroxol", brandNames: ["Mucolite", "Ambrodil"], strength: ["30mg", "30mg/5ml"], form: "Syrup", category: "Cough & Cold" },
  { id: "cc3", genericName: "Bromhexine", brandNames: ["Bisolvon", "Brozeet"], strength: ["8mg", "4mg/5ml"], form: "Syrup", category: "Cough & Cold" },
  { id: "cc4", genericName: "Guaifenesin", brandNames: ["Ascoril", "Grilinctus"], strength: ["50mg/5ml", "100mg/5ml"], form: "Syrup", category: "Cough & Cold" },
  { id: "cc5", genericName: "Terbutaline + Bromhexine + Guaifenesin", brandNames: ["Ascoril LS", "Alex Syrup"], strength: ["5ml"], form: "Syrup", category: "Cough & Cold" },
  { id: "cc6", genericName: "Salbutamol", brandNames: ["Asthalin", "Ventorlin"], strength: ["2mg", "4mg", "2mg/5ml"], form: "Syrup", category: "Bronchodilator" },
  { id: "cc7", genericName: "Levosalbutamol", brandNames: ["Levolin"], strength: ["1mg", "2mg"], form: "Tablet", category: "Bronchodilator" },
  { id: "cc8", genericName: "Theophylline", brandNames: ["Deriphyllin", "Theobid"], strength: ["100mg", "200mg"], form: "Tablet", category: "Bronchodilator" },
  { id: "cc9", genericName: "Doxofylline", brandNames: ["Doxobid", "Synasma"], strength: ["200mg", "400mg"], form: "Tablet", category: "Bronchodilator" },
  { id: "cc10", genericName: "Phenylephrine + Paracetamol + CPM", brandNames: ["Sinarest", "Cheston Cold", "Coldact"], strength: ["500mg combo"], form: "Tablet", category: "Cough & Cold" },
  { id: "cc11", genericName: "Xylometazoline Nasal Drops", brandNames: ["Otrivin", "Nasivion"], strength: ["0.05%", "0.1%"], form: "Syrup", category: "Cough & Cold" },
  { id: "cc12", genericName: "Budesonide", brandNames: ["Budecort", "Pulmicort"], strength: ["100mcg", "200mcg"], form: "Injection", category: "Steroid inhalation" },

  // ── Antidiabetics ──────────────────────────────────────────────────────────
  { id: "db1", genericName: "Metformin", brandNames: ["Glycomet", "Glucophage", "Obimet"], strength: ["500mg", "850mg", "1000mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db2", genericName: "Glimepiride", brandNames: ["Amaryl", "Glimestar"], strength: ["1mg", "2mg", "3mg", "4mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db3", genericName: "Glimepiride + Metformin", brandNames: ["Glimestar-M", "Amaryl-M"], strength: ["1mg/500mg", "2mg/500mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db4", genericName: "Gliclazide", brandNames: ["Diamicron", "Reclide"], strength: ["40mg", "60mg", "80mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db5", genericName: "Sitagliptin", brandNames: ["Januvia", "Istavel"], strength: ["50mg", "100mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db6", genericName: "Vildagliptin", brandNames: ["Galvus", "Zomelis"], strength: ["50mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db7", genericName: "Teneligliptin", brandNames: ["Tenepride", "Zita"], strength: ["20mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db8", genericName: "Dapagliflozin", brandNames: ["Forxiga", "Dapa"], strength: ["5mg", "10mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db9", genericName: "Empagliflozin", brandNames: ["Jardiance", "Gibtulio"], strength: ["10mg", "25mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db10", genericName: "Pioglitazone", brandNames: ["Pioz", "Piosafe"], strength: ["7.5mg", "15mg", "30mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db11", genericName: "Acarbose", brandNames: ["Glucobay"], strength: ["25mg", "50mg"], form: "Tablet", category: "Antidiabetic" },
  { id: "db12", genericName: "Insulin Glargine", brandNames: ["Lantus", "Basalog"], strength: ["100 IU/ml"], form: "Injection", category: "Antidiabetic" },
  { id: "db13", genericName: "Human Insulin (Mixtard)", brandNames: ["Mixtard", "Huminsulin"], strength: ["30/70 100 IU/ml"], form: "Injection", category: "Antidiabetic" },

  // ── Cardiovascular / antihypertensives ─────────────────────────────────────
  { id: "cv1", genericName: "Amlodipine", brandNames: ["Amlong", "Amlopres", "Norvasc"], strength: ["2.5mg", "5mg", "10mg"], form: "Tablet", category: "Antihypertensive" },
  { id: "cv2", genericName: "Telmisartan", brandNames: ["Telma", "Telsartan"], strength: ["20mg", "40mg", "80mg"], form: "Tablet", category: "Antihypertensive" },
  { id: "cv3", genericName: "Telmisartan + Amlodipine", brandNames: ["Telma-AM", "Telsartan-AM"], strength: ["40mg/5mg"], form: "Tablet", category: "Antihypertensive" },
  { id: "cv4", genericName: "Losartan Potassium", brandNames: ["Losar", "Repace", "Cozaar"], strength: ["25mg", "50mg", "100mg"], form: "Tablet", category: "Antihypertensive" },
  { id: "cv5", genericName: "Olmesartan", brandNames: ["Olmat", "Olmesar"], strength: ["20mg", "40mg"], form: "Tablet", category: "Antihypertensive" },
  { id: "cv6", genericName: "Ramipril", brandNames: ["Cardace", "Ramistar"], strength: ["2.5mg", "5mg", "10mg"], form: "Capsule", category: "Antihypertensive" },
  { id: "cv7", genericName: "Enalapril", brandNames: ["Envas", "Enam"], strength: ["2.5mg", "5mg", "10mg"], form: "Tablet", category: "Antihypertensive" },
  { id: "cv8", genericName: "Metoprolol", brandNames: ["Metolar", "Betaloc"], strength: ["25mg", "50mg", "100mg"], form: "Tablet", category: "Beta blocker" },
  { id: "cv9", genericName: "Atenolol", brandNames: ["Aten", "Tenormin"], strength: ["25mg", "50mg"], form: "Tablet", category: "Beta blocker" },
  { id: "cv10", genericName: "Bisoprolol", brandNames: ["Concor", "Corbis"], strength: ["2.5mg", "5mg"], form: "Tablet", category: "Beta blocker" },
  { id: "cv11", genericName: "Carvedilol", brandNames: ["Carca", "Carloc"], strength: ["3.125mg", "6.25mg", "12.5mg"], form: "Tablet", category: "Beta blocker" },
  { id: "cv12", genericName: "Hydrochlorothiazide", brandNames: ["Aquazide", "Hydrazide"], strength: ["12.5mg", "25mg"], form: "Tablet", category: "Diuretic" },
  { id: "cv13", genericName: "Furosemide", brandNames: ["Lasix", "Frusenex"], strength: ["20mg", "40mg"], form: "Tablet", category: "Diuretic" },
  { id: "cv14", genericName: "Torsemide", brandNames: ["Dytor", "Tide"], strength: ["5mg", "10mg", "20mg"], form: "Tablet", category: "Diuretic" },
  { id: "cv15", genericName: "Spironolactone", brandNames: ["Aldactone", "Spiromide"], strength: ["25mg", "50mg"], form: "Tablet", category: "Diuretic" },
  { id: "cv16", genericName: "Atorvastatin", brandNames: ["Atorva", "Lipitor", "Storvas"], strength: ["10mg", "20mg", "40mg", "80mg"], form: "Tablet", category: "Statin" },
  { id: "cv17", genericName: "Rosuvastatin", brandNames: ["Rosuvas", "Crestor"], strength: ["5mg", "10mg", "20mg"], form: "Tablet", category: "Statin" },
  { id: "cv18", genericName: "Clopidogrel", brandNames: ["Plavix", "Clopilet"], strength: ["75mg"], form: "Tablet", category: "Antiplatelet" },
  { id: "cv19", genericName: "Nitroglycerin", brandNames: ["Angispan", "Nitrocontin"], strength: ["2.5mg", "6.4mg"], form: "Tablet", category: "Antianginal" },
  { id: "cv20", genericName: "Isosorbide Mononitrate", brandNames: ["Monotrate", "Ismo"], strength: ["10mg", "20mg", "40mg"], form: "Tablet", category: "Antianginal" },
  { id: "cv21", genericName: "Warfarin", brandNames: ["Warf", "Uniwarfin"], strength: ["1mg", "2mg", "5mg"], form: "Tablet", category: "Anticoagulant" },

  // ── Vitamins / supplements ─────────────────────────────────────────────────
  { id: "vt1", genericName: "Vitamin D3 (Cholecalciferol)", brandNames: ["Calcirol", "Uprise D3", "D-Rise"], strength: ["1000 IU", "2000 IU", "60000 IU"], form: "Capsule", category: "Vitamin / Supplement" },
  { id: "vt2", genericName: "Calcium + Vitamin D3", brandNames: ["Shelcal", "Calcimax", "Ostocalcium"], strength: ["250mg", "500mg"], form: "Tablet", category: "Vitamin / Supplement" },
  { id: "vt3", genericName: "Vitamin B Complex", brandNames: ["Becosules", "Neurobion"], strength: ["1 cap"], form: "Capsule", category: "Vitamin / Supplement" },
  { id: "vt4", genericName: "Vitamin B12 (Methylcobalamin)", brandNames: ["Nurokind", "Methycobal"], strength: ["500mcg", "1500mcg"], form: "Tablet", category: "Vitamin / Supplement" },
  { id: "vt5", genericName: "Vitamin C (Ascorbic Acid)", brandNames: ["Limcee", "Celin"], strength: ["500mg"], form: "Tablet", category: "Vitamin / Supplement" },
  { id: "vt6", genericName: "Iron + Folic Acid", brandNames: ["Livogen", "Autrin", "Fefol"], strength: ["100mg", "150mg"], form: "Tablet", category: "Vitamin / Supplement" },
  { id: "vt7", genericName: "Ferrous Ascorbate", brandNames: ["Orofer XT", "Dexorange"], strength: ["100mg"], form: "Tablet", category: "Vitamin / Supplement" },
  { id: "vt8", genericName: "Folic Acid", brandNames: ["Folvite"], strength: ["5mg"], form: "Tablet", category: "Vitamin / Supplement" },
  { id: "vt9", genericName: "Zinc Sulphate", brandNames: ["Zincovit", "Z&D"], strength: ["20mg", "50mg"], form: "Tablet", category: "Vitamin / Supplement" },
  { id: "vt10", genericName: "Multivitamin Syrup", brandNames: ["Zincovit Syrup", "A to Z Syrup"], strength: ["5ml"], form: "Syrup", category: "Vitamin / Supplement" },
  { id: "vt11", genericName: "Omega-3 Fatty Acids", brandNames: ["Maxepa", "Seven Seas"], strength: ["500mg", "1000mg"], form: "Capsule", category: "Vitamin / Supplement" },
  { id: "vt12", genericName: "Protein Powder", brandNames: ["Protinex", "Pediasure"], strength: ["200g", "400g"], form: "Syrup", category: "Vitamin / Supplement" },

  // ── Dermatology ────────────────────────────────────────────────────────────
  { id: "dm1", genericName: "Clotrimazole Cream", brandNames: ["Candid", "Canesten"], strength: ["1%"], form: "Syrup", category: "Dermatology" },
  { id: "dm2", genericName: "Ketoconazole Cream", brandNames: ["Nizral", "Ketostar"], strength: ["2%"], form: "Syrup", category: "Dermatology" },
  { id: "dm3", genericName: "Luliconazole Cream", brandNames: ["Lulifin", "Lulican"], strength: ["1%"], form: "Syrup", category: "Dermatology" },
  { id: "dm4", genericName: "Mupirocin Ointment", brandNames: ["T-Bact", "Bactroban"], strength: ["2%"], form: "Syrup", category: "Dermatology" },
  { id: "dm5", genericName: "Fusidic Acid Cream", brandNames: ["Fucidin", "Fudic"], strength: ["2%"], form: "Syrup", category: "Dermatology" },
  { id: "dm6", genericName: "Betamethasone Cream", brandNames: ["Betnovate", "Diprovate"], strength: ["0.05%", "0.1%"], form: "Syrup", category: "Dermatology" },
  { id: "dm7", genericName: "Mometasone Cream", brandNames: ["Elocon", "Momate"], strength: ["0.1%"], form: "Syrup", category: "Dermatology" },
  { id: "dm8", genericName: "Permethrin Lotion", brandNames: ["Permite", "Scabper"], strength: ["5%"], form: "Syrup", category: "Dermatology" },
  { id: "dm9", genericName: "Benzoyl Peroxide Gel", brandNames: ["Persol", "Benzac"], strength: ["2.5%", "5%"], form: "Syrup", category: "Dermatology" },
  { id: "dm10", genericName: "Adapalene Gel", brandNames: ["Adaferin", "Differin"], strength: ["0.1%"], form: "Syrup", category: "Dermatology" },
  { id: "dm11", genericName: "Isotretinoin", brandNames: ["Sotret", "Accufine"], strength: ["10mg", "20mg"], form: "Capsule", category: "Dermatology" },
  { id: "dm12", genericName: "Calamine Lotion", brandNames: ["Caladryl", "Lacto Calamine"], strength: ["100ml"], form: "Syrup", category: "Dermatology" },
  { id: "dm13", genericName: "Silver Sulfadiazine Cream", brandNames: ["Silverex", "Burnol Plus"], strength: ["1%"], form: "Syrup", category: "Dermatology" },
  { id: "dm14", genericName: "Tacrolimus Ointment", brandNames: ["Tacroz", "Protopic"], strength: ["0.03%", "0.1%"], form: "Syrup", category: "Dermatology" },

  // ── Endocrine / misc ───────────────────────────────────────────────────────
  { id: "ms1", genericName: "Levothyroxine (Thyroxine Sodium)", brandNames: ["Thyronorm", "Eltroxin"], strength: ["25mcg", "50mcg", "75mcg", "100mcg"], form: "Tablet", category: "Hormone" },
  { id: "ms2", genericName: "Prednisolone", brandNames: ["Omnacortil", "Wysolone"], strength: ["5mg", "10mg", "20mg", "40mg"], form: "Tablet", category: "Steroid" },
  { id: "ms3", genericName: "Deflazacort", brandNames: ["Defcort", "Zempred"], strength: ["6mg", "12mg", "30mg"], form: "Tablet", category: "Steroid" },
  { id: "ms4", genericName: "Methylprednisolone", brandNames: ["Medrol", "Solu-Medrol"], strength: ["4mg", "8mg", "16mg"], form: "Tablet", category: "Steroid" },
  { id: "ms5", genericName: "Alprazolam", brandNames: ["Alprax", "Restyl"], strength: ["0.25mg", "0.5mg"], form: "Tablet", category: "Anxiolytic" },
  { id: "ms6", genericName: "Clonazepam", brandNames: ["Rivotril", "Lonazep"], strength: ["0.25mg", "0.5mg", "1mg"], form: "Tablet", category: "Anxiolytic" },
  { id: "ms7", genericName: "Escitalopram", brandNames: ["Nexito", "Cipralex"], strength: ["5mg", "10mg", "20mg"], form: "Tablet", category: "Antidepressant" },
  { id: "ms8", genericName: "Sertraline", brandNames: ["Zoloft", "Serta"], strength: ["25mg", "50mg", "100mg"], form: "Tablet", category: "Antidepressant" },
  { id: "ms9", genericName: "Amitriptyline", brandNames: ["Tryptomer"], strength: ["10mg", "25mg"], form: "Tablet", category: "Antidepressant" },
  { id: "ms10", genericName: "Pregabalin", brandNames: ["Pregeb", "Lyrica"], strength: ["75mg", "150mg"], form: "Capsule", category: "Neuropathic pain" },
  { id: "ms11", genericName: "Gabapentin", brandNames: ["Gabapin", "Neurontin"], strength: ["100mg", "300mg", "400mg"], form: "Capsule", category: "Neuropathic pain" },
  { id: "ms12", genericName: "Levetiracetam", brandNames: ["Levipil", "Keppra"], strength: ["250mg", "500mg", "1g"], form: "Tablet", category: "Antiepileptic" },
  { id: "ms13", genericName: "Sodium Valproate", brandNames: ["Valparin", "Encorate"], strength: ["200mg", "500mg"], form: "Tablet", category: "Antiepileptic" },
  { id: "ms14", genericName: "Tamsulosin", brandNames: ["Urimax", "Veltam"], strength: ["0.4mg"], form: "Capsule", category: "Urology" },
  { id: "ms15", genericName: "Sildenafil", brandNames: ["Viagra", "Penegra"], strength: ["25mg", "50mg", "100mg"], form: "Tablet", category: "Urology" },
  { id: "ms16", genericName: "Finasteride", brandNames: ["Finpecia", "Finast"], strength: ["1mg", "5mg"], form: "Tablet", category: "Urology" },
  { id: "ms17", genericName: "Allopurinol", brandNames: ["Zyloric", "Ciploric"], strength: ["100mg", "300mg"], form: "Tablet", category: "Antigout" },
  { id: "ms18", genericName: "Febuxostat", brandNames: ["Febustat", "Zurig"], strength: ["40mg", "80mg"], form: "Tablet", category: "Antigout" },
  { id: "ms19", genericName: "Colchicine", brandNames: ["Zycolchin", "Goutnil"], strength: ["0.5mg"], form: "Tablet", category: "Antigout" },
  { id: "ms20", genericName: "Betahistine", brandNames: ["Vertin", "Betavert"], strength: ["8mg", "16mg", "24mg"], form: "Tablet", category: "Vertigo" },
  { id: "ms21", genericName: "Cinnarizine", brandNames: ["Stugeron", "Vertigon"], strength: ["25mg", "75mg"], form: "Tablet", category: "Vertigo" },
  { id: "ms22", genericName: "Tranexamic Acid", brandNames: ["Trapic", "Pause"], strength: ["500mg"], form: "Tablet", category: "Haemostatic" },
  { id: "ms23", genericName: "Diclofenac Eye Drops", brandNames: ["Voveran Eye", "Dicloran"], strength: ["0.1%"], form: "Syrup", category: "Ophthalmic" },
  { id: "ms24", genericName: "Moxifloxacin Eye Drops", brandNames: ["Vigamox", "Milflox"], strength: ["0.5%"], form: "Syrup", category: "Ophthalmic" },
  { id: "ms25", genericName: "Carboxymethylcellulose Eye Drops", brandNames: ["Refresh Tears", "Optive"], strength: ["0.5%"], form: "Syrup", category: "Ophthalmic" },
];

export const MEDICINES: Medicine[] = RAW.map((m) => ({
  ...m,
  name: m.genericName,
  brand: m.brandNames[0] ?? "",
  strengths: m.strength,
}));

export interface MedicineMatch {
  medicine: Medicine;
  /** Brand that matched the query (falls back to the primary brand). */
  brand: string;
  /** The field text where the match was found, for highlighting. */
  matchedIn: "generic" | "brand";
  score: number;
  fuzzy: boolean;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n] ?? 0;
}

/** Best (lowest) fuzzy distance of the query against any word in the text. */
function fuzzyDistance(text: string, q: string): number {
  const words = text.split(/[\s+()/,-]+/).filter(Boolean);
  let best = levenshtein(text, q);
  for (const w of words) {
    const d = levenshtein(w.slice(0, Math.max(q.length, 3)), q);
    if (d < best) best = d;
  }
  return best;
}

function scoreField(text: string, q: string): number | null {
  const t = text.toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  const words = t.split(/[\s+()/,-]+/);
  if (words.some((w) => w.startsWith(q))) return 2;
  if (t.includes(q)) return 3;
  return null;
}

export const MAX_SUGGESTIONS = 8;

/**
 * Case-insensitive, substring-anywhere search across generic names AND brand
 * names, ranked best-first. Falls back to Levenshtein "closest matches" when
 * nothing matches literally.
 */
export function rankMedicines(query: string, limit: number = MAX_SUGGESTIONS): MedicineMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact: MedicineMatch[] = [];
  for (const m of MEDICINES) {
    let best: MedicineMatch | null = null;
    const gs = scoreField(m.genericName, q);
    if (gs !== null) {
      best = { medicine: m, brand: m.brand, matchedIn: "generic", score: gs, fuzzy: false };
    }
    for (const b of m.brandNames) {
      const bs = scoreField(b, q);
      if (bs !== null && (!best || bs < best.score)) {
        best = { medicine: m, brand: b, matchedIn: "brand", score: bs + 0.5, fuzzy: false };
      }
    }
    if (best) exact.push(best);
  }

  if (exact.length) {
    return exact
      .sort((a, b) => a.score - b.score || a.medicine.genericName.localeCompare(b.medicine.genericName))
      .slice(0, limit);
  }

  // Fuzzy fallback — "closest matches"
  const fuzzy = MEDICINES.map((m) => {
    const dGeneric = fuzzyDistance(m.genericName.toLowerCase(), q);
    let brand = m.brand;
    let dBrand = Infinity;
    for (const b of m.brandNames) {
      const d = fuzzyDistance(b.toLowerCase(), q);
      if (d < dBrand) {
        dBrand = d;
        brand = b;
      }
    }
    const useBrand = dBrand < dGeneric;
    return {
      medicine: m,
      brand: useBrand ? brand : m.brand,
      matchedIn: (useBrand ? "brand" : "generic") as "brand" | "generic",
      score: Math.min(dGeneric, dBrand),
      fuzzy: true,
    };
  })
    .filter((r) => r.score <= Math.max(2, Math.floor(q.length / 2)))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return fuzzy;
}

/** Async wrapper so a real API can be dropped in later. */
export async function searchMedicines(query: string): Promise<Medicine[]> {
  return rankMedicines(query).map((r) => r.medicine);
}

export const FREQUENCIES = [
  { label: "Once daily", short: "1-0-0", times: 1 },
  { label: "Twice daily", short: "1-0-1", times: 2 },
  { label: "Thrice daily", short: "1-1-1", times: 3 },
] as const;

export const INSTRUCTION_CHIPS = [
  "Take after food",
  "Complete full course",
  "Drink plenty of water",
  "Avoid alcohol",
  "Take with milk",
];
