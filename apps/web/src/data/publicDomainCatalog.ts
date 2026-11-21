import type { DifficultyTier, PianoGrade } from '../core/types';

export interface PublicDomainCatalogEntry {
  id: string;
  title: string;
  composer: string;
  source?: string;
  era: 'Baroque' | 'Classical' | 'Romantic' | 'Impressionist' | 'Ragtime' | 'Traditional';
  difficulty: DifficultyTier;
  grade: PianoGrade;
  gradeNum: number; // 1..9
  keyLabel: string;
  format: 'mxl' | 'mid';
  fileName: string;
  rawUrl: string;
}

const RAW_BASE = 'https://raw.githubusercontent.com/musetrainer/library/master/scores/';

interface CompactCatalogRow {
  id: string;
  t: string;
  c: string;
  s: string;
  e: PublicDomainCatalogEntry['era'];
  d: DifficultyTier;
  g: PianoGrade;
  gn: number;
  k: string;
  f: 'mxl' | 'mid';
  u: string;
}

let cachedFullCatalog: PublicDomainCatalogEntry[] | null = null;

/**
 * Lazily loads the deduplicated 3,190+ Public Domain Piano MusicXML/MIDI catalog index
 * from `./catalog/public-domain-catalog.json` (falls back to the bundled 44 flagship scores offline).
 */
export async function loadFullPublicDomainCatalog(): Promise<PublicDomainCatalogEntry[]> {
  if (cachedFullCatalog) return cachedFullCatalog;
  try {
    const res = await fetch('./catalog/public-domain-catalog.json');
    if (!res.ok) return [...PUBLIC_DOMAIN_CATALOG];
    const rows = (await res.json()) as CompactCatalogRow[];
    cachedFullCatalog = rows.map((r) => ({
      id: r.id,
      title: r.t,
      composer: r.c,
      source: r.s,
      era: r.e,
      difficulty: r.d,
      grade: r.g,
      gradeNum: r.gn,
      keyLabel: r.k,
      format: r.f,
      fileName: decodeURIComponent(r.u.split('/').pop() || `${r.id}.${r.f}`),
      rawUrl: r.u,
    }));
    return cachedFullCatalog;
  } catch {
    return [...PUBLIC_DOMAIN_CATALOG];
  }
}

function makeEntry(
  id: string,
  title: string,
  composer: string,
  era: PublicDomainCatalogEntry['era'],
  gradeNum: number,
  keyLabel: string,
  fileName: string,
): PublicDomainCatalogEntry {
  const gradeMap: Record<number, PianoGrade> = {
    1: 'Grade 1',
    2: 'Grade 2',
    3: 'Grade 3',
    4: 'Grade 4',
    5: 'Grade 5',
    6: 'Grade 6',
    7: 'Grade 7',
    8: 'Grade 8',
    9: 'Diploma',
  };
  const difficulty: DifficultyTier =
    gradeNum <= 3 ? 'beginner' : gradeNum <= 6 ? 'intermediate' : 'advanced';

  return {
    id,
    title,
    composer,
    era,
    difficulty,
    grade: gradeMap[gradeNum],
    gradeNum,
    keyLabel,
    format: 'mxl',
    fileName,
    rawUrl: `${RAW_BASE}${encodeURIComponent(fileName)}`,
  };
}

/**
 * Curated 100% Public-Domain Classical & Traditional Piano MusicXML (.mxl) Catalog
 * graded by international piano standards (Beginner Grade 1–3, Intermediate Grade 4–6, Advanced Grade 7–Diploma).
 */
export const PUBLIC_DOMAIN_CATALOG: ReadonlyArray<PublicDomainCatalogEntry> = [
  // ==================== BEGINNER (Grade 1–3) ====================
  makeEntry('pd-ode-easy', 'Ode to Joy (Easy Variation)', 'L. van Beethoven', 'Classical', 1, 'C Major', 'Ode_to_Joy_Easy_variation.mxl'),
  makeEntry('pd-greensleeves', 'Greensleeves (Easy Piano)', 'Traditional', 'Traditional', 1, 'A Minor', 'Greensleeves_for_Piano_easy_and_beautiful.mxl'),
  makeEntry('pd-happy-bday', 'Happy Birthday to You', 'Traditional', 'Traditional', 1, 'C Major', 'Happy_Birthday_To_You_C_Major.mxl'),
  makeEntry('pd-minuet-g', 'Minuet in G Major (BWV Anh. 114)', 'J. S. Bach / C. Petzold', 'Baroque', 2, 'G Major', 'Bach_Minuet_in_G_Major_BWV_Anh._114.mxl'),
  makeEntry('pd-canon-easy', 'Canon in D (Easy Piano)', 'Johann Pachelbel', 'Baroque', 2, 'D Major', 'Canon_in_D_easy.mxl'),
  makeEntry('pd-fur-elise-easy', 'Für Elise (Easy Piano)', 'L. van Beethoven', 'Classical', 2, 'A Minor', 'Fur_Elise_Easy_Piano.mxl'),
  makeEntry('pd-carol-easy', 'Carol of the Bells (Easy Piano)', 'Mykola Leontovych', 'Traditional', 2, 'E Minor', 'Carol_of_the_Bells_easy_piano.mxl'),
  makeEntry('pd-prelude-c', 'Prelude No. 1 in C Major (BWV 846)', 'J. S. Bach', 'Baroque', 3, 'C Major', 'Prelude_I_in_C_major_BWV_846_-_Well_Tempered_Clavier_First_Book.mxl'),
  makeEntry('pd-gymnopedie-1', 'Gymnopédie No. 1', 'Erik Satie', 'Impressionist', 3, 'D Major', 'Erik_Satie_-_Gymnopedie_No.1.mxl'),
  makeEntry('pd-gnossienne-1', 'Gnossienne No. 1', 'Erik Satie', 'Impressionist', 3, 'F Minor', 'Gnossienne_No._1.mxl'),
  makeEntry('pd-waltz-am', 'Waltz in A Minor (B. 150)', 'Frédéric Chopin', 'Romantic', 3, 'A Minor', 'Waltz_in_A_MinorChopin.mxl'),
  makeEntry('pd-nocturne-9-2-easy', 'Nocturne Op. 9 No. 2 (Easy)', 'Frédéric Chopin', 'Romantic', 3, 'Eb Major', 'Nocturne_in_E-flat_Major_Op._9_No._2_Easy.mxl'),

  // ==================== INTERMEDIATE (Grade 4–6) ====================
  makeEntry('pd-prelude-em', 'Prelude in E Minor Op. 28 No. 4', 'Frédéric Chopin', 'Romantic', 4, 'E Minor', 'Prlude_Opus_28_No._4_in_E_Minor__Chopin.mxl'),
  makeEntry('pd-canon-full', 'Canon in D (Full Arrangement)', 'Johann Pachelbel', 'Baroque', 4, 'D Major', 'Canon_in_D.mxl'),
  makeEntry('pd-air-g', 'Air on the G String (Solo Piano)', 'J. S. Bach', 'Baroque', 4, 'D Major', 'J._S._Bach_-_Air_on_the_G_String_Piano_arrangement.mxl'),
  makeEntry('pd-danse-vill', 'Danse Villageoise', 'L. van Beethoven', 'Classical', 4, 'C Major', 'DANSE_VILLAGEOISE_Beethoven.mxl'),
  makeEntry('pd-fur-elise-full', 'Für Elise (Full Original)', 'L. van Beethoven', 'Classical', 5, 'A Minor', 'Fur_Elise.mxl'),
  makeEntry('pd-moonlight-1', 'Moonlight Sonata — 1st Movement', 'L. van Beethoven', 'Classical', 5, 'C# Minor', 'Sonate_No._14_Moonlight_1st_Movement.mxl'),
  makeEntry('pd-mozart-k545', 'Piano Sonata No. 16 in C Major (K. 545)', 'W. A. Mozart', 'Classical', 5, 'C Major', 'Sonata_No._16_1st_Movement_K._545.mxl'),
  makeEntry('pd-ave-maria', 'Ave Maria (D. 839 · Solo Piano)', 'Franz Schubert', 'Romantic', 5, 'Bb Major', 'Ave_Maria_D839_-_Schubert_-_Solo_Piano_Arrg..mxl'),
  makeEntry('pd-entertainer', 'The Entertainer (1902)', 'Scott Joplin', 'Ragtime', 5, 'C Major', 'The_Entertainer_-_Scott_Joplin_-_1902.mxl'),
  makeEntry('pd-sugar-plum', 'Dance of the Sugar Plum Fairy', 'P. I. Tchaikovsky', 'Romantic', 5, 'E Minor', 'Dance_of_the_sugar_plum_fairy.mxl'),
  makeEntry('pd-lacrimosa', 'Lacrimosa (from Requiem)', 'W. A. Mozart', 'Classical', 5, 'D Minor', 'Lacrimosa_-_Requiem.mxl'),
  makeEntry('pd-twinkle-var', '12 Variations on "Ah, vous dirai-je, Maman"', 'W. A. Mozart', 'Classical', 5, 'C Major', '12_Variations_of_Twinkle_Twinkle_Little_Star.mxl'),
  makeEntry('pd-swan-lake', 'Swan Lake Theme (Solo Piano)', 'P. I. Tchaikovsky', 'Romantic', 5, 'B Minor', 'Swan_Lake.mxl'),
  makeEntry('pd-turkish-march', 'Rondo Alla Turca (Turkish March, K. 331)', 'W. A. Mozart', 'Classical', 6, 'A Minor', 'Piano_Sonata_No._11_K._331_3rd_Movement_Rondo_alla_Turca.mxl'),
  makeEntry('pd-arabesque-1', 'Arabesque No. 1 in E Major (L. 66)', 'Claude Debussy', 'Impressionist', 6, 'E Major', 'Arabesque_L._66_No._1_in_E_Major.mxl'),
  makeEntry('pd-pathetique-2', 'Pathétique Sonata Op. 13 — 2nd Mvt', 'L. van Beethoven', 'Classical', 6, 'Ab Major', 'Sonate_No._8_Pathetique_2nd_Movement.mxl'),
  makeEntry('pd-hungarian-5', 'Hungarian Dance No. 5 in G Minor', 'Johannes Brahms', 'Romantic', 6, 'G Minor', 'Hungarian_Dance_No_5_in_G_Minor.mxl'),
  makeEntry('pd-maple-leaf', 'Maple Leaf Rag', 'Scott Joplin', 'Ragtime', 6, 'Ab Major', 'Maple_Leaf_Rag_Scott_Joplin.mxl'),
  makeEntry('pd-waltz-64-2', 'Waltz Op. 64 No. 2 in C# Minor', 'Frédéric Chopin', 'Romantic', 6, 'C# Minor', 'Waltz_Opus_64_No._2_in_C_Minor.mxl'),
  makeEntry('pd-nocturne-20', 'Nocturne No. 20 in C# Minor (Op. posth.)', 'Frédéric Chopin', 'Romantic', 6, 'C# Minor', 'Nocturne_in_C_sharp_Minor.mxl'),

  // ==================== ADVANCED (Grade 7–8 & Diploma) ====================
  makeEntry('pd-clair-de-lune', 'Clair de Lune (Suite Bergamasque)', 'Claude Debussy', 'Impressionist', 7, 'Db Major', 'Clair_de_lune_-_Claude_Debussy.mxl'),
  makeEntry('pd-nocturne-9-2', 'Nocturne Op. 9 No. 2 in Eb Major', 'Frédéric Chopin', 'Romantic', 7, 'Eb Major', 'Chopin_-_Nocturne_Op_9_No_2_E_Flat_Major.mxl'),
  makeEntry('pd-prelude-cm', 'Prelude No. 2 in C Minor (BWV 847)', 'J. S. Bach', 'Baroque', 7, 'C Minor', 'Prelude_No._2_BWV_847_in_C_Minor.mxl'),
  makeEntry('pd-nocturne-9-1', 'Nocturne Op. 9 No. 1 in Bb Minor', 'Frédéric Chopin', 'Romantic', 8, 'Bb Minor', 'Chopin_-_Nocturne_Op._9_No._1.mxl'),
  makeEntry('pd-liebestraum-3', 'Liebestraum No. 3 in Ab Major', 'Franz Liszt', 'Romantic', 8, 'Ab Major', 'Liebestraum_No._3_in_A_Major.mxl'),
  makeEntry('pd-toccata-dm', 'Toccata and Fugue in D Minor (BWV 565)', 'J. S. Bach', 'Baroque', 8, 'D Minor', 'Bach_Toccata_and_Fugue_in_D_Minor_Piano_solo.mxl'),
  makeEntry('pd-symphony-5', 'Symphony No. 5 — 1st Mvt (Solo Piano)', 'L. van Beethoven', 'Classical', 8, 'C Minor', 'Beethoven_Symphony_No._5_1st_movement_Piano_solo.mxl'),
  makeEntry('pd-serenade', 'Serenade (Ständchen · arr. Liszt)', 'F. Schubert / F. Liszt', 'Romantic', 8, 'D Minor', 'Schubert_Serenade_-_Standchen_-_By_Lizst.mxl'),
  makeEntry('pd-moonlight-3', 'Moonlight Sonata — 3rd Mvt (Presto Agitato)', 'L. van Beethoven', 'Classical', 9, 'C# Minor', 'Sonate_No._14_Moonlight_3rd_Movement.mxl'),
  makeEntry('pd-bumblebee', 'Flight of the Bumblebee', 'N. Rimsky-Korsakov', 'Romantic', 9, 'A Minor', 'Flight_of_the_Bumblebee.mxl'),
  makeEntry('pd-ballade-1', 'Ballade No. 1 in G Minor Op. 23', 'Frédéric Chopin', 'Romantic', 9, 'G Minor', 'Chopin_-_Ballade_no._1_in_G_minor_Op._23.mxl'),
  makeEntry('pd-campanella', 'La Campanella (Paganini Étude No. 3)', 'Franz Liszt', 'Romantic', 9, 'G# Minor', 'La_Campanella_-_Grandes_Etudes_de_Paganini_No._3_-_Franz_Liszt.mxl'),
];
