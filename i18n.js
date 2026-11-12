'use strict';

/*
 * Czech translation for the whole site.
 * The pages are written in English; this file swaps the text for Czech when CZ is chosen.
 * - Text in the HTML and text the scripts add later is matched against the dictionary.
 * - Text with numbers in it goes through t('… {name} …', { name }) in the scripts.
 * - Elements whose text contains markup use data-i18n-html="key".
 */

const LANG_KEY = 'kalk-lang';
const LANG = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'cs' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return /^(cs|sk)\b/i.test(navigator.language || '') ? 'cs' : 'en';
})();

const CS = {
  // Navigation & shared
  'Calculator': 'Kalkulačka',
  'Coordinates': 'Souřadnice',
  'Star map': 'Hvězdná mapa',
  'Sun': 'Slunce',
  'Clear': 'Smazat',
  'Date': 'Datum',
  'Time': 'Čas',
  'Today': 'Dnes',
  'Latitude': 'Zeměpisná šířka',
  'Longitude': 'Zeměpisná délka',
  'Zoom in': 'Přiblížit',
  'Zoom out': 'Oddálit',
  'below the horizon': 'pod obzorem',
  'Language': 'Jazyk',

  // Calculator
  'Scientific Calculator': 'Vědecká kalkulačka',
  'Move cursor left': 'Posunout kurzor doleva',
  'Move cursor right': 'Posunout kurzor doprava',
  'Previous calculation': 'Předchozí výpočet',
  'Next calculation': 'Další výpočet',
  'Angle unit': 'Jednotka úhlu',
  'Trigonometry': 'Goniometrické funkce',
  'Enter degrees/minutes/seconds, or show the result in that format': 'Zadat stupně/minuty/vteřiny nebo tak zobrazit výsledek',
  'Powers & logarithms': 'Mocniny a logaritmy',
  'Logarithm with base: logₐ(base, x)': 'Logaritmus o základu: logₐ(základ, x)',
  'More': 'Další',
  'Fraction: a⌟b': 'Zlomek: a⌟b',
  'Toggle fraction / decimal result': 'Přepnout výsledek zlomek / desetinné číslo',
  'Engineering notation (press again to shift)': 'Inženýrský zápis (dalším stiskem posunete exponent)',
  'Random number 0–1': 'Náhodné číslo 0–1',
  'Rand': 'Náh',
  'Memory': 'Paměť',
  'Store the result: press STO, then a variable': 'Uložit výsledek: stiskněte STO a pak proměnnou',
  'Add the result to M': 'Přičíst výsledek k M',
  'Subtract the result from M': 'Odečíst výsledek od M',
  'Reset all variables to 0': 'Vynulovat všechny proměnné',
  'Last result': 'Poslední výsledek',
  'mem-clear': 'Nuluj',
  'Tap a variable to use it in a calculation. To save a result, press STO and then a variable.': 'Klepnutím na proměnnou ji použijete ve výpočtu. Výsledek uložíte stiskem STO a pak proměnné.',
  'Choose a variable to store the result in.': 'Vyberte proměnnou, do které se výsledek uloží.',
  'Number pad': 'Číselná klávesnice',
  '×10 to the power': '×10 na',
  'Negative sign': 'Záporné znaménko',
  'Syntax ERROR': 'Chyba syntaxe',
  'Math ERROR': 'Matematická chyba',
  'help-keys': 'Klávesnice: číslice, <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> <kbd>^</kbd> <kbd>(</kbd> <kbd>)</kbd>, <kbd>Enter</kbd> rovná se, <kbd>Backspace</kbd> smazat znak, <kbd>Esc</kbd> vymazat, <kbd>s</kbd> <kbd>c</kbd> <kbd>t</kbd> goniometrické funkce, <kbd>l</kbd> ln, <kbd>g</kbd> log, <kbd>r</kbd> √, <kbd>p</kbd> π, <kbd>m</kbd> jednotka úhlu, <kbd>←</kbd> <kbd>→</kbd> kurzor, <kbd>↑</kbd> <kbd>↓</kbd> historie',

  // GPS coordinates
  'GPS Coordinates': 'GPS souřadnice',
  'Fit points': 'Zobrazit body',
  'Whole Earth': 'Celá Země',
  'Angles': 'Úhly',
  '＋ Click to add': '＋ Přidat kliknutím',
  'Click the globe to add a point': 'Kliknutím na glóbus přidáte bod',
  'Great circle g, sides 90° − lat': 'Hlavní kružnice g, strany 90° − šířka',
  'Equator': 'Rovník',
  'Greenwich': 'Greenwich',
  'Drag to turn · scroll or pinch to zoom': 'Tažením otočíte · kolečkem nebo prsty přiblížíte',
  'Globe with the points, the great-circle path and the triangle with the North Pole': 'Glóbus s body, cestou po hlavní kružnici a trojúhelníkem se severním pólem',
  'Points': 'Body',
  'Example…': 'Příklad…',
  'World cities': 'Světová města',
  'Prague landmarks': 'Pražské památky',
  'Load an example': 'Načíst příklad',
  'Name': 'Název',
  'Remove': 'Odebrat',
  'Remove point': 'Odebrat bod',
  '+ Add point': '+ Přidat bod',
  'Paste a list of points': 'Vložit seznam bodů',
  'paste-help': 'Jeden bod na řádek, např. <code>50.4743964N, 14.3278153E</code>, <code>50.4743964, 14.3278153</code> nebo <code>Domov 50°28′27.8″N 14°19′40.1″E</code>. Dvojici můžete vložit i přímo do buňky tabulky.',
  'Replace points': 'Nahradit body',
  'Add to list': 'Přidat do seznamu',
  'Distance': 'Vzdálenost',
  'from': 'odkud',
  'to': 'kam',
  'Swap': 'Prohodit',
  'Swap points': 'Prohodit body',
  'Area': 'Plocha',
  'All points, joined in list order along great circles.': 'Všechny body spojené v pořadí seznamu po hlavních kružnicích.',
  'Decimal ⇄ DMS converter': 'Převod desetinné stupně ⇄ °′″',
  'Decimal degrees': 'Desetinné stupně',
  'Degrees, minutes, seconds': 'Stupně, minuty, vteřiny',
  'A negative value or S / W means south or west.': 'Záporná hodnota nebo S / W znamená jih nebo západ.',
  'How the distance is calculated': 'Jak se vzdálenost počítá',
  'Land and borders:': 'Pevnina a hranice:',
  '(public domain).': '(volné dílo).',
  'Add at least 3 points to calculate an area.': 'Pro výpočet plochy přidejte aspoň 3 body.',
  '1 row is empty or invalid and is skipped.': '1 řádek je prázdný nebo neplatný a přeskočí se.',
  '{n} rows are empty or invalid and are skipped.': 'Prázdné nebo neplatné řádky ({n}) se přeskočí.',
  'Perimeter': 'Obvod',
  'Centroid': 'Těžiště',
  'Order': 'Pořadí',
  'counter-clockwise': 'proti směru hodinových ručiček',
  'clockwise': 'po směru hodinových ručiček',
  'The edges cross each other, so this area is not meaningful. Reorder the points so they go around the shape.': 'Hrany se navzájem kříží, takže plocha nedává smysl. Seřaďte body tak, aby obcházely obrazec.',
  'Point': 'Bod',
  'Add at least 2 points.': 'Přidejte aspoň 2 body.',
  'Choose two different points.': 'Vyberte dva různé body.',
  'Great-circle distance': 'Vzdálenost po hlavní kružnici',
  'Central angle g': 'Středový úhel g',
  'Initial bearing': 'Počáteční azimut',
  'Final bearing': 'Koncový azimut',
  'Midpoint': 'Střed',
  'Rhumb line': 'Loxodroma',
  'constant bearing {b}': 'stálý azimut {b}',
  'Add at least two points and pick P₁ and P₂ under "Distance" to see how the distance is calculated.': 'Přidejte aspoň dva body a v části „Vzdálenost“ vyberte P₁ a P₂ – uvidíte, jak se vzdálenost počítá.',
  'Sides from the North Pole (colatitudes)': 'Strany od severního pólu (doplňky do 90°)',
  'Angle at the North Pole': 'Úhel u severního pólu',
  'Spherical law of cosines (the side opposite the pole)': 'Sférická kosinová věta (strana naproti pólu)',
  'Central angle between the points': 'Středový úhel mezi body',
  'Angles of the triangle at the points (bearings)': 'Úhly trojúhelníku u bodů (azimuty)',
  'start at P₁: ': 'výchozí v P₁: ',
  'arrive at P₂: ': 'příchozí v P₂: ',
  'R is the mean Earth radius. For very short distances arccos loses precision, so g is computed with the equivalent vector (haversine-type) formula. The Earth is treated as a sphere; on the real ellipsoid distances differ by up to about 0.5 %.': 'R je střední poloměr Země. U velmi krátkých vzdáleností ztrácí arccos přesnost, proto se g počítá rovnocenným vektorovým vzorcem (typu haversine). Země je brána jako koule; na skutečném elipsoidu se vzdálenosti liší až asi o 0,5 %.',
  'North Pole (lat = 90°)': 'Severní pól (šířka = 90°)',
  'North Pole': 'Severní pól',
  'great-circle distance g = {d}': 'vzdálenost po hlavní kružnici g = {d}',
  'Remove all points?': 'Odebrat všechny body?',
  'No points found. Use one point per line, e.g. "Home 50.4743964N, 14.3278153E".': 'Nenašly se žádné body. Zadejte jeden bod na řádek, např. „Domov 50.4743964N, 14.3278153E“.',
  'N': 'S', 'NE': 'SV', 'E': 'V', 'SE': 'JV', 'S': 'J', 'SW': 'JZ', 'W': 'Z', 'NW': 'SZ',

  // Star map
  'Rotating Star Map': 'Otočná mapa hvězdné oblohy',
  'Sky window': 'Okno oblohy',
  'Whole map': 'Celá mapa',
  'Rotating star map. Drag to turn the star disc.': 'Otočná mapa hvězdné oblohy. Tažením otočíte hvězdný kotouč.',
  'Drag to turn the star disc · scroll or double-click to zoom · Shift + drag to move the view · hover a star for details.': 'Tažením otočíte hvězdný kotouč · kolečkem nebo dvojklikem přiblížíte · Shift + tažení posune pohled · najetím na hvězdu zobrazíte podrobnosti.',
  'Drag with one finger to turn the disc · pinch to zoom and move · tap a star for details.': 'Jedním prstem otočíte kotouč · dvěma prsty přiblížíte a posunete · klepnutím na hvězdu zobrazíte podrobnosti.',
  'Hold the map above your head with the direction you are facing at the bottom.': 'Držte mapu nad hlavou tak, aby světová strana, ke které jste otočeni, byla dole.',
  'Date & time': 'Datum a čas',
  'Now': 'Teď',
  '▶ Play': '▶ Start',
  '❚❚ Pause': '❚❚ Stop',
  'Location': 'Poloha',
  'Place': 'Místo',
  'Custom': 'Vlastní',
  'Vienna': 'Vídeň',
  'Berlin': 'Berlín',
  'London': 'Londýn',
  'Use my location': 'Použít moji polohu',
  'Show': 'Zobrazit',
  'Constellation lines': 'Čáry souhvězdí',
  'Constellation names': 'Názvy souhvězdí',
  'Star names': 'Názvy hvězd',
  'Milky Way': 'Mléčná dráha',
  'Messier objects': 'Messierovy objekty',
  'Grid & ecliptic': 'Síť a ekliptika',
  'See-through cover': 'Průhledný kryt',
  'Faintest stars:': 'Nejslabší hvězdy:',
  'magnitude {m}': 'magnituda {m}',
  'Sky labels': 'Popisky oblohy',
  'Your browser does not support location.': 'Váš prohlížeč nepodporuje zjištění polohy.',
  'Finding your location…': 'Zjišťuji polohu…',
  'Location set.': 'Poloha nastavena.',
  'Could not get your location. Type it in or pick a place.': 'Polohu se nepodařilo zjistit. Zadejte ji nebo vyberte místo.',
  'Local time': 'Místní čas',
  'Sidereal time': 'Hvězdný čas',
  'Sun altitude': 'Výška Slunce',
  'Sky': 'Obloha',
  'day': 'den',
  'civil twilight': 'občanský soumrak',
  'nautical twilight': 'nautický soumrak',
  'astronomical twilight': 'astronomický soumrak',
  'night': 'noc',
  'Star': 'Hvězda',
  'altitude {alt}° · {dir} ({az}°)': 'výška {alt}° · {dir} ({az}°)',
  'Star data: Hipparcos catalogue via': 'Data hvězd: katalog Hipparcos z projektu',
  'by Olaf Frohn (BSD-3-Clause).': 'od Olafa Frohna (BSD-3-Clause).',
  'galaxy': 'galaxie',
  'spiral galaxy': 'spirální galaxie',
  'lenticular galaxy': 'čočková galaxie',
  'dwarf spheroidal galaxy': 'trpasličí sféroidální galaxie',
  'irregular galaxy': 'nepravidelná galaxie',
  'elliptical galaxy': 'eliptická galaxie',
  'open cluster': 'otevřená hvězdokupa',
  'globular cluster': 'kulová hvězdokupa',
  'emission nebula': 'emisní mlhovina',
  'bright nebula': 'jasná mlhovina',
  'star-forming region': 'oblast tvorby hvězd',
  'reflection nebula': 'reflexní mlhovina',
  'planetary nebula': 'planetární mlhovina',
  'supernova remnant': 'pozůstatek supernovy',
  'dark nebula': 'temná mlhovina',
  'star cloud': 'hvězdné mračno',
  'double star': 'dvojhvězda',
  'asterism': 'asterismus',

  // Sun
  'Sun Declination': 'Deklinace Slunce',
  'Look up a date': 'Vyhledat datum',
  "The declination is the Sun's angle north or south of the celestial equator.": 'Deklinace je úhel, o který je Slunce severně nebo jižně od nebeského rovníku.',
  'sun-signs': '<b class="pos">+</b> Slunce je nad (severně od) nebeským rovníkem · <b class="neg">−</b> pod ním (jižně).',
  'Values change by a few arcminutes from year to year. Click any cell to look up that day. The noon height and day length are calculated from the table value and your latitude (day length ignores refraction, so real days are a few minutes longer).': 'Hodnoty se rok od roku liší o několik obloukových minut. Kliknutím na buňku zobrazíte daný den. Polední výška a délka dne se počítají z hodnoty v tabulce a vaší zeměpisné šířky (délka dne nezahrnuje refrakci, skutečné dny jsou o pár minut delší).',
  'Declination through the year': 'Deklinace během roku',
  'Above zero the Sun is north of the celestial equator, below zero south of it.': 'Nad nulou je Slunce severně od nebeského rovníku, pod nulou jižně od něj.',
  'Declination': 'Deklinace',
  'Noon height': 'Polední výška',
  'Day length': 'Délka dne',
  'Night length': 'Délka noci',
  'What to show': 'Co zobrazit',
  'Line chart of the Sun\'s declination for every day of the year': 'Spojnicový graf deklinace Slunce pro každý den v roce',
  'Hover to read a day, click to look it up. The table below has every value.': 'Najetím zobrazíte hodnoty dne, kliknutím ho vyhledáte. Všechny hodnoty jsou v tabulce níže.',
  'Height of the Sun at noon': 'Výška Slunce v poledne',
  'At latitude {lat}. 0° is the horizon.': 'Pro zeměpisnou šířku {lat}. 0° je obzor.',
  'Length of the day': 'Délka dne',
  'Sunrise to sunset at latitude {lat}, without refraction.': 'Od východu do západu Slunce pro šířku {lat}, bez refrakce.',
  'Tropic of Cancer +23°26′': 'Obratník Raka +23°26′',
  'Tropic of Capricorn −23°26′': 'Obratník Kozoroha −23°26′',
  'horizon': 'obzor',
  'north of the equator (+)': 'severně od rovníku (+)',
  'south of the equator (−)': 'jižně od rovníku (−)',
  'Summer solstice': 'Letní slunovrat',
  'Winter solstice': 'Zimní slunovrat',
  'Spring equinox': 'Jarní rovnodennost',
  'Autumn equinox': 'Podzimní rovnodennost',
  'Longest day': 'Nejdelší den',
  'Shortest day': 'Nejkratší den',
  'Highest': 'Nejvýše',
  'Lowest': 'Nejníže',
  'Day': 'Den',
  'No value for this date.': 'Pro toto datum není hodnota.',
  'above the celestial equator': 'nad nebeským rovníkem',
  'below the celestial equator': 'pod nebeským rovníkem',
  'on the celestial equator (equinox)': 'na nebeském rovníku (rovnodennost)',
  'Sun at noon': 'Slunce v poledne',
  '{h} in the south': '{h} na jihu',
  '{h} in the north': '{h} na severu',
  '{h} (overhead)': '{h} (v nadhlavníku)',
  '24 h (midnight sun)': '24 h (půlnoční slunce)',
  '0 h (polar night)': '0 h (polární noc)',
  'JAN': 'LED', 'FEB': 'ÚNO', 'MAR': 'BŘE', 'APR': 'DUB', 'MAY': 'KVĚ', 'JUN': 'ČVN',
  'JUL': 'ČVC', 'AUG': 'SRP', 'SEP': 'ZÁŘ', 'OCT': 'ŘÍJ', 'NOV': 'LIS', 'DEC': 'PRO',
  'Jan': 'led', 'Feb': 'úno', 'Mar': 'bře', 'Apr': 'dub', 'May': 'kvě', 'Jun': 'čvn',
  'Jul': 'čvc', 'Aug': 'srp', 'Sep': 'zář', 'Oct': 'říj', 'Nov': 'lis', 'Dec': 'pro',
};

// Translate a string; {name} placeholders are filled from vars.
function t(s, vars) {
  let out = LANG === 'cs' && Object.prototype.hasOwnProperty.call(CS, s) ? CS[s] : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}

(() => {
  document.documentElement.lang = LANG;
  const ATTRS = ['title', 'aria-label', 'placeholder'];
  // Single letters such as compass points are only translated where a script asks for them.
  const lookup = s => {
    const k = s.trim();
    if (k.length < 2 || /^[NSEW]{1,2}$/.test(k) || !Object.prototype.hasOwnProperty.call(CS, k)) return null;
    return s.replace(k, CS[k]);
  };

  function translate(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      const r = lookup(root.nodeValue);
      if (r !== null) root.nodeValue = r;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const els = [root, ...root.querySelectorAll('*')];
    for (const el of els) {
      if (el.matches('script, style, textarea, input')) {
        if (el.matches('input, textarea') && el.placeholder) {
          const r = lookup(el.placeholder);
          if (r !== null) el.placeholder = r;
        }
        continue;
      }
      const key = el.getAttribute('data-i18n-html');
      if (key && CS[key]) { el.innerHTML = CS[key]; continue; }
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v) continue;
        const r = lookup(v);
        if (r !== null) el.setAttribute(a, r);
      }
      for (const n of el.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) {
          const r = lookup(n.nodeValue);
          if (r !== null) n.nodeValue = r;
        }
      }
    }
  }

  // Language switch in the page header
  function addSwitch() {
    const head = document.querySelector('.page-head');
    if (!head || head.querySelector('.lang-switch')) return;
    const box = document.createElement('div');
    box.className = 'lang-switch segmented';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language / Jazyk');
    for (const [code, text] of [['cs', 'CZ'], ['en', 'EN']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.className = code === LANG ? 'active' : '';
      b.setAttribute('aria-pressed', String(code === LANG));
      b.addEventListener('click', () => {
        if (code === LANG) return;
        try { localStorage.setItem(LANG_KEY, code); } catch { /* storage unavailable */ }
        location.reload();
      });
      box.append(b);
    }
    head.append(box);
  }

  function start() {
    addSwitch();
    if (LANG !== 'cs') return;
    document.title = t(document.title);
    translate(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') translate(m.target);
        else if (m.type === 'attributes') translate(m.target);
        else for (const n of m.addedNodes) translate(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
