// قائمة ولايات الجزائر الـ 58 مع الرموز

export interface Wilaya {
  code: number;
  name: string;
  nameAr: string;
  abbr: string; // اختصار من 3 حروف لرمز المؤسسة
}

export const WILAYAS: Wilaya[] = [
  { code: 1, name: 'Adrar', nameAr: 'أدرار', abbr: 'ADR' },
  { code: 2, name: 'Chlef', nameAr: 'الشلف', abbr: 'CHL' },
  { code: 3, name: 'Laghouat', nameAr: 'الأغواط', abbr: 'LAG' },
  { code: 4, name: 'Oum El Bouaghi', nameAr: 'أم البواقي', abbr: 'OEB' },
  { code: 5, name: 'Batna', nameAr: 'باتنة', abbr: 'BAT' },
  { code: 6, name: 'Béjaïa', nameAr: 'بجاية', abbr: 'BJA' },
  { code: 7, name: 'Biskra', nameAr: 'بسكرة', abbr: 'BIS' },
  { code: 8, name: 'Béchar', nameAr: 'بشار', abbr: 'BCR' },
  { code: 9, name: 'Blida', nameAr: 'البليدة', abbr: 'BLI' },
  { code: 10, name: 'Bouira', nameAr: 'البويرة', abbr: 'BOU' },
  { code: 11, name: 'Tamanrasset', nameAr: 'تمنراست', abbr: 'TMR' },
  { code: 12, name: 'Tébessa', nameAr: 'تبسة', abbr: 'TEB' },
  { code: 13, name: 'Tlemcen', nameAr: 'تلمسان', abbr: 'TLM' },
  { code: 14, name: 'Tiaret', nameAr: 'تيارت', abbr: 'TIA' },
  { code: 15, name: 'Tizi Ouzou', nameAr: 'تيزي وزو', abbr: 'TZO' },
  { code: 16, name: 'Alger', nameAr: 'الجزائر', abbr: 'ALG' },
  { code: 17, name: 'Djelfa', nameAr: 'الجلفة', abbr: 'DJL' },
  { code: 18, name: 'Jijel', nameAr: 'جيجل', abbr: 'JIJ' },
  { code: 19, name: 'Sétif', nameAr: 'سطيف', abbr: 'SET' },
  { code: 20, name: 'Saïda', nameAr: 'سعيدة', abbr: 'SAI' },
  { code: 21, name: 'Skikda', nameAr: 'سكيكدة', abbr: 'SKK' },
  { code: 22, name: 'Sidi Bel Abbès', nameAr: 'سيدي بلعباس', abbr: 'SBA' },
  { code: 23, name: 'Annaba', nameAr: 'عنابة', abbr: 'ANB' },
  { code: 24, name: 'Guelma', nameAr: 'قالمة', abbr: 'GUE' },
  { code: 25, name: 'Constantine', nameAr: 'قسنطينة', abbr: 'CON' },
  { code: 26, name: 'Médéa', nameAr: 'المدية', abbr: 'MED' },
  { code: 27, name: 'Mostaganem', nameAr: 'مستغانم', abbr: 'MOS' },
  { code: 28, name: "M'sila", nameAr: 'المسيلة', abbr: 'MSI' },
  { code: 29, name: 'Mascara', nameAr: 'معسكر', abbr: 'MAS' },
  { code: 30, name: 'Ouargla', nameAr: 'ورقلة', abbr: 'OUA' },
  { code: 31, name: 'Oran', nameAr: 'وهران', abbr: 'ORA' },
  { code: 32, name: 'El Bayadh', nameAr: 'البيض', abbr: 'EBA' },
  { code: 33, name: 'Illizi', nameAr: 'إليزي', abbr: 'ILL' },
  { code: 34, name: 'Bordj Bou Arréridj', nameAr: 'برج بوعريريج', abbr: 'BBA' },
  { code: 35, name: 'Boumerdès', nameAr: 'بومرداس', abbr: 'BMD' },
  { code: 36, name: 'El Tarf', nameAr: 'الطارف', abbr: 'ETR' },
  { code: 37, name: 'Tindouf', nameAr: 'تندوف', abbr: 'TIN' },
  { code: 38, name: 'Tissemsilt', nameAr: 'تيسمسيلت', abbr: 'TIS' },
  { code: 39, name: 'El Oued', nameAr: 'الوادي', abbr: 'EOU' },
  { code: 40, name: 'Khenchela', nameAr: 'خنشلة', abbr: 'KHE' },
  { code: 41, name: 'Souk Ahras', nameAr: 'سوق أهراس', abbr: 'SAH' },
  { code: 42, name: 'Tipaza', nameAr: 'تيبازة', abbr: 'TIP' },
  { code: 43, name: 'Mila', nameAr: 'ميلة', abbr: 'MIL' },
  { code: 44, name: 'Aïn Defla', nameAr: 'عين الدفلى', abbr: 'ADF' },
  { code: 45, name: 'Naâma', nameAr: 'النعامة', abbr: 'NAA' },
  { code: 46, name: 'Aïn Témouchent', nameAr: 'عين تموشنت', abbr: 'ATE' },
  { code: 47, name: 'Ghardaïa', nameAr: 'غرداية', abbr: 'GHA' },
  { code: 48, name: 'Relizane', nameAr: 'غليزان', abbr: 'REL' },
  // الولايات المنتدبة (2019)
  { code: 49, name: 'Timimoun', nameAr: 'تيميمون', abbr: 'TMM' },
  { code: 50, name: 'Bordj Badji Mokhtar', nameAr: 'برج باجي مختار', abbr: 'BBM' },
  { code: 51, name: 'Ouled Djellal', nameAr: 'أولاد جلال', abbr: 'ODJ' },
  { code: 52, name: 'Béni Abbès', nameAr: 'بني عباس', abbr: 'BAB' },
  { code: 53, name: 'Aïn Salah', nameAr: 'عين صالح', abbr: 'ASA' },
  { code: 54, name: 'Aïn Guezzam', nameAr: 'عين قزام', abbr: 'AGZ' },
  { code: 55, name: 'Touggourt', nameAr: 'تقرت', abbr: 'TOU' },
  { code: 56, name: 'Djanet', nameAr: 'جانت', abbr: 'DJA' },
  { code: 57, name: 'El M\'Ghair', nameAr: 'المغير', abbr: 'EMG' },
  { code: 58, name: 'El Meniaa', nameAr: 'المنيعة', abbr: 'EMN' },
];

// دالة لتوليد رمز المؤسسة تلقائياً
export function generateInstitutionCode(wilayaCode: number, type: string): string {
  const wilaya = WILAYAS.find(w => w.code === wilayaCode);
  if (!wilaya) return 'UNK-001';

  const typeCode =
    type === 'military' ? 'UNI' :
    type === 'school' ? 'SCH' :
    type === 'company' ? 'COM' :
    'TRN';
  const random = Math.floor(Math.random() * 99) + 1;
  return `${wilaya.abbr}-${typeCode}-${String(random).padStart(2, '0')}`;
}

// دالة بحث في الولايات
export function searchWilayas(query: string): Wilaya[] {
  const q = query.trim().toLowerCase();
  if (!q) return WILAYAS;
  return WILAYAS.filter(w => 
    w.nameAr.includes(q) || 
    w.name.toLowerCase().includes(q) || 
    String(w.code) === q ||
    w.abbr.toLowerCase().includes(q)
  );
}
