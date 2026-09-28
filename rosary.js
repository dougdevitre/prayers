// The Rosary: its mysteries, the Fatima Prayer, and the order it is prayed
// in, shared by the app's guided Rosary, the Rosary pages and the tests.
//
// Only what is not already in prayers.js lives here. The Sign of the Cross,
// the Apostles' Creed, the Our Father, the Hail Mary, the Glory Be and the
// Hail Holy Queen are the Prayer Book's own (kept word for word with REMAM);
// a step names one by its id, so the Rosary and the Prayer Book can never
// read differently.
//
// Draft devotional content, pending pastoral review like the rest of Stand
// (meta.review below). The mysteries and the days they are prayed on follow
// St John Paul II, Rosarium Virginis Mariae (2002), §19 and §38:
// https://www.vatican.va/content/john-paul-ii/en/apost_letters/2002/documents/hf_jp-ii_apl_20021016_rosarium-virginis-mariae.html
//
// Each mystery carries one short verse, English from the World English Bible
// and Spanish from the Reina-Valera 1909 (both public domain), each a
// contiguous excerpt of the source: scripts/verify-scripture.js checks every
// one against scripts/web-source.json and scripts/es-source.json. The
// Assumption and the Coronation are not narrated in scripture; their verses
// are from the readings the Church uses on the Assumption (Luke 1:39–56 and
// Revelation 12), and `note` says so wherever they are shown.
//
// A browser global and a CommonJS module, like prayers.js. Strings are in
// double quotes so scripts/apply-review.js can find and change them.

(function (root) {
  const rosary = {
    "meta": {
      "review": "draft-pending-review",
      "source": "Rosarium Virginis Mariae (2002), §19 and §38"
    },
    "name": { "en": "The Rosary", "es": "El Santo Rosario" },
    "fatima": {
      "name": { "en": "Fatima Prayer", "es": "Oración de Fátima" },
      "text": {
        "en": "O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to Heaven, especially those in most need of Thy mercy.",
        "es": "Oh Jesús mío, perdona nuestros pecados, líbranos del fuego del infierno, lleva al cielo a todas las almas, especialmente a las más necesitadas de tu misericordia."
      }
    },
    // The three Hail Marys after the first Our Father.
    "virtues": { "en": "For faith, hope and charity", "es": "Por la fe, la esperanza y la caridad" },
    // Sunday is 0, as Date.getDay() counts.
    "sets": [
      {
        "id": "joyful",
        "slug": { "en": "joyful", "es": "gozosos" },
        "name": { "en": "The Joyful Mysteries", "es": "Misterios Gozosos" },
        "days": [1, 6],
        "mysteries": [
          { "id": "annunciation", "name": { "en": "The Annunciation", "es": "La Anunciación" }, "ref": "Luke 1:38",
            "verse": { "en": "Behold, the servant of the Lord; let it be done to me according to your word.", "es": "He aquí la sierva del Señor; hágase á mí conforme á tu palabra." } },
          { "id": "visitation", "name": { "en": "The Visitation", "es": "La Visitación" }, "ref": "Luke 1:42",
            "verse": { "en": "Blessed are you among women, and blessed is the fruit of your womb!", "es": "Bendita tú entre las mujeres, y bendito el fruto de tu vientre." } },
          { "id": "nativity", "name": { "en": "The Nativity", "es": "El Nacimiento de Jesús" }, "ref": "Luke 2:7",
            "verse": { "en": "She gave birth to her firstborn son. She wrapped him in bands of cloth, and laid him in a feeding trough.", "es": "Y parió á su hijo primogénito, y le envolvió en pañales, y acostóle en un pesebre." } },
          { "id": "presentation", "name": { "en": "The Presentation in the Temple", "es": "La Presentación de Jesús en el Templo" }, "ref": "Luke 2:22",
            "verse": { "en": "They brought him up to Jerusalem, to present him to the Lord.", "es": "Le trajeron á Jerusalem para presentarle al Señor." } },
          { "id": "finding", "name": { "en": "The Finding in the Temple", "es": "El Niño Jesús hallado en el Templo" }, "ref": "Luke 2:49",
            "verse": { "en": "Didn’t you know that I must be in my Father’s house?", "es": "¿No sabíais que en los negocios de mi Padre me conviene estar?" } }
        ]
      },
      {
        "id": "luminous",
        "slug": { "en": "luminous", "es": "luminosos" },
        "name": { "en": "The Luminous Mysteries", "es": "Misterios Luminosos" },
        "days": [4],
        "mysteries": [
          { "id": "baptism", "name": { "en": "The Baptism of the Lord", "es": "El Bautismo de Jesús en el Jordán" }, "ref": "Matthew 3:17",
            "verse": { "en": "This is my beloved Son, with whom I am well pleased.", "es": "Este es mi Hijo amado, en el cual tengo contentamiento." } },
          { "id": "cana", "name": { "en": "The Wedding at Cana", "es": "Las bodas de Caná" }, "ref": "John 2:5",
            "verse": { "en": "Whatever he says to you, do it.", "es": "Haced todo lo que os dijere." } },
          { "id": "proclamation", "name": { "en": "The Proclamation of the Kingdom", "es": "El anuncio del Reino de Dios" }, "ref": "Mark 1:15",
            "verse": { "en": "The time is fulfilled, and God’s Kingdom is at hand! Repent, and believe in the Good News.", "es": "El tiempo es cumplido, y el reino de Dios está cerca: arrepentíos, y creed al evangelio." } },
          { "id": "transfiguration", "name": { "en": "The Transfiguration", "es": "La Transfiguración" }, "ref": "Luke 9:35",
            "verse": { "en": "This is my beloved Son. Listen to him!", "es": "Este es mi Hijo amado; á él oid." } },
          { "id": "eucharist", "name": { "en": "The Institution of the Eucharist", "es": "La institución de la Eucaristía" }, "ref": "Luke 22:19",
            "verse": { "en": "This is my body which is given for you. Do this in memory of me.", "es": "Esto es mi cuerpo, que por vosotros es dado: haced esto en memoria de mí." } }
        ]
      },
      {
        "id": "sorrowful",
        "slug": { "en": "sorrowful", "es": "dolorosos" },
        "name": { "en": "The Sorrowful Mysteries", "es": "Misterios Dolorosos" },
        "days": [2, 5],
        "mysteries": [
          { "id": "agony", "name": { "en": "The Agony in the Garden", "es": "La oración de Jesús en el Huerto" }, "ref": "Luke 22:42",
            "verse": { "en": "Father, if you are willing, remove this cup from me. Nevertheless, not my will, but yours, be done.", "es": "Padre, si quieres, pasa este vaso de mí; empero no se haga mi voluntad, sino la tuya." } },
          { "id": "scourging", "name": { "en": "The Scourging at the Pillar", "es": "La flagelación del Señor" }, "ref": "John 19:1",
            "verse": { "en": "So Pilate then took Jesus, and flogged him.", "es": "Tomó Pilato á Jesús, y le azotó." } },
          { "id": "crowning", "name": { "en": "The Crowning with Thorns", "es": "La coronación de espinas" }, "ref": "Matthew 27:29",
            "verse": { "en": "They braided a crown of thorns and put it on his head.", "es": "Pusieron sobre su cabeza una corona tejida de espinas." } },
          { "id": "carrying", "name": { "en": "The Carrying of the Cross", "es": "Jesús con la cruz a cuestas" }, "ref": "John 19:17",
            "verse": { "en": "He went out, bearing his cross.", "es": "Y llevando su cruz, salió al lugar que se dice de la Calavera." } },
          { "id": "crucifixion", "name": { "en": "The Crucifixion", "es": "La crucifixión y muerte de Jesús" }, "ref": "Luke 23:46",
            "verse": { "en": "Father, into your hands I commit my spirit!", "es": "Padre, en tus manos encomiendo mi espíritu." } }
        ]
      },
      {
        "id": "glorious",
        "slug": { "en": "glorious", "es": "gloriosos" },
        "name": { "en": "The Glorious Mysteries", "es": "Misterios Gloriosos" },
        "days": [0, 3],
        "mysteries": [
          { "id": "resurrection", "name": { "en": "The Resurrection", "es": "La Resurrección del Señor" }, "ref": "Luke 24:6",
            "verse": { "en": "He isn’t here, but is risen.", "es": "No está aquí, mas ha resucitado." } },
          { "id": "ascension", "name": { "en": "The Ascension", "es": "La Ascensión del Señor" }, "ref": "Acts 1:9",
            "verse": { "en": "As they were looking, he was taken up, and a cloud received him out of their sight.", "es": "Fué alzado; y una nube le recibió y le quitó de sus ojos." } },
          { "id": "pentecost", "name": { "en": "The Descent of the Holy Spirit", "es": "La venida del Espíritu Santo" }, "ref": "Acts 2:4",
            "verse": { "en": "They were all filled with the Holy Spirit.", "es": "Y fueron todos llenos del Espíritu Santo." } },
          { "id": "assumption", "name": { "en": "The Assumption of Mary", "es": "La Asunción de María" }, "ref": "Luke 1:49",
            "verse": { "en": "For he who is mighty has done great things for me. Holy is his name.", "es": "Porque me ha hecho grandes cosas el Poderoso; y santo es su nombre." },
            "note": { "en": "Not narrated in scripture; this verse is from the Gospel read on the feast of the Assumption.", "es": "No se narra en la Escritura; este versículo es del Evangelio de la fiesta de la Asunción." } },
          { "id": "coronation", "name": { "en": "The Coronation of Mary", "es": "La coronación de María" }, "ref": "Revelation 12:1",
            "verse": { "en": "A great sign was seen in heaven: a woman clothed with the sun, and the moon under her feet, and on her head a crown of twelve stars.", "es": "Una grande señal apareció en el cielo: una mujer vestida del sol, y la luna debajo de sus pies, y sobre su cabeza una corona de doce estrellas." },
            "note": { "en": "Not narrated in scripture; this verse is from a reading used on the feast of the Assumption.", "es": "No se narra en la Escritura; este versículo es de una lectura de la fiesta de la Asunción." } }
        ]
      }
    ]
  };

  const setById = id => rosary.sets.find(s => s.id === id) || null;

  /** The mysteries prayed on a date's weekday (Rosarium Virginis Mariae §38). */
  const setForDate = date => rosary.sets.find(s => s.days.includes(date.getDay()));

  /**
   * The Rosary as steps, in order, for one set of mysteries:
   *   { kind: "prayer", prayer: <prayers.js id>, count?, decade?, label? }
   *   { kind: "mystery", decade, mystery }   (announces the decade)
   *   { kind: "fatima", decade }
   * `count` is how many times the step is prayed (the Hail Marys); `decade`
   * is 1 to 5 inside the decades. With { fatima: false } the Fatima Prayer
   * is left out, for readers who do not pray it.
   */
  function rosarySteps(setId, { fatima = true } = {}) {
    const set = setById(setId);
    if (!set) return null;
    const p = (prayer, extra) => ({ kind: "prayer", prayer, ...extra });
    const steps = [
      p("sign-of-the-cross"),
      p("apostles-creed"),
      p("our-father"),
      p("hail-mary", { count: 3, label: "virtues" }),
      p("glory-be")
    ];
    set.mysteries.forEach((mystery, i) => {
      const decade = i + 1;
      steps.push({ kind: "mystery", decade, mystery: mystery.id });
      steps.push(p("our-father", { decade }));
      steps.push(p("hail-mary", { count: 10, decade }));
      steps.push(p("glory-be", { decade }));
      if (fatima) steps.push({ kind: "fatima", decade });
    });
    steps.push(p("hail-holy-queen"), p("sign-of-the-cross"));
    return steps;
  }

  const api = { rosary, setById, setForDate, rosarySteps };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
