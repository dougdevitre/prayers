// The form layer of the fillable workbook (scripts/build-print-workbook.js).
// Chromium prints the pages; this lays real form fields over the places the
// page marks for writing, ticking and choosing, so the workbook can be filled
// in on screen in any PDF app that fills in forms.
//
// Secure by default: the fields carry no JavaScript and no submit, import or
// launch action, and nothing here reaches the network. What a reader types is
// kept in their copy of the file and nowhere else.
//
// A question asked in more than one place is one field with a widget in each
// place: a day's fear check-in also shows on the tracker's chart and on the
// week's chart, and the day's "Done" is the tracker's "Practice" tick. Answer
// it once and it shows everywhere.

const {
  PDFDocument, PDFName, PDFHexString, PDFRef, PDFDict, PDFArray, PDFStream, AcroButtonFlags,
  rgb, drawEllipse, drawCheckMark
} = require("pdf-lib");

const INK = rgb(0x13 / 255, 0x2a / 255, 0x3a / 255);
const GOLD = rgb(0xb8 / 255, 0x87 / 255, 0x32 / 255);
const PT = 72 / 96; // CSS pixels to PDF points
const KINDS = ["text", "check", "radio"];
const LOOKS = ["check", "ring", "dot", "gold"];

/**
 * The "on" look of a tick box or a circle, drawn where the page printed it,
 * in the widget's own coordinates:
 *   check  a tick inside the box
 *   ring   a gold ring around a numbered circle, as if circled by hand
 *   dot    the circle filled in
 *   gold   the circle filled in gold (the three breaths)
 * (x, y) is the printed shape's centre and r its radius; the widget's own box
 * may be larger, so it is easier to hit.
 */
const onLook = (look, x, y, r) => look === "check" ? drawCheckMark({ x, y, size: r * 0.9, thickness: 1.4, color: INK })
  : look === "ring" ? drawEllipse({ x, y, xScale: r + 1.3, yScale: r + 1.3, borderColor: GOLD, borderWidth: 1.8 })
  : drawEllipse({ x, y, xScale: r, yScale: r, color: look === "gold" ? GOLD : INK, borderWidth: 0 });

/** Removes every object nothing in the document refers to (pdf-lib keeps replaced appearances). */
function dropUnreferenced(context) {
  const seen = new Set();
  const visit = obj => {
    if (obj instanceof PDFRef) {
      if (seen.has(obj.tag)) return;
      seen.add(obj.tag);
      visit(context.lookup(obj));
    } else if (obj instanceof PDFDict) {
      for (const [, value] of obj.entries()) visit(value);
    } else if (obj instanceof PDFArray) {
      for (const value of obj.asArray()) visit(value);
    } else if (obj instanceof PDFStream) {
      visit(obj.dict);
    }
  };
  for (const key of ["Root", "Info", "Encrypt"]) if (context.trailerInfo[key]) visit(context.trailerInfo[key]);
  for (const [ref] of context.enumerateIndirectObjects()) if (!seen.has(ref.tag)) context.delete(ref);
}

const toPoints = (rect, pageHeight) => ({
  x: rect.x * PT, y: pageHeight - (rect.y + rect.h) * PT, width: rect.w * PT, height: rect.h * PT
});

/**
 * Adds the form to a printed workbook. `widgets` lists every widget in page
 * order, as the build measured them on the page:
 *   { page, name, kind: "text"|"check"|"radio", tip, value?, label?, multiline?,
 *     size?, look?, hit: {x, y, w, h}, mark?: {x, y, w, h} }
 * `tip` is the field's tooltip; a radio button adds its own `label` (or its
 * value) to it.
 * Rectangles are CSS pixels from the page's top-left corner; `hit` is where the
 * widget sits, `mark` the printed box or circle its "on" look fills (it
 * defaults to `hit`). Widgets that share a name are one field. Returns the
 * PDF's bytes.
 */
async function addFields(pdfBytes, widgets) {
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const form = pdf.getForm();
  const pages = pdf.getPages();
  const fields = new Map();
  const looks = new Map(); // widget dict → { look, mark, value }

  for (const w of widgets) {
    if (!KINDS.includes(w.kind)) throw new Error(`${w.name}: unknown kind ${w.kind}`);
    if (w.kind !== "text" && !LOOKS.includes(w.look)) throw new Error(`${w.name}: unknown look ${w.look}`);
    if (w.kind === "radio" && !w.value) throw new Error(`${w.name}: a radio button needs a value`);
    const page = pages[w.page];
    if (!page) throw new Error(`${w.name}: no page ${w.page}`);
    const height = page.getHeight();
    // No border and no fill: the page already prints the box, the circle or the line.
    const place = { ...toPoints(w.hit, height), borderWidth: 0, borderColor: undefined, backgroundColor: undefined, textColor: INK };

    let entry = fields.get(w.name);
    if (entry && entry.kind !== w.kind) throw new Error(`${w.name}: both ${entry.kind} and ${w.kind}`);
    if (!entry) {
      const field = w.kind === "text" ? form.createTextField(w.name)
        : w.kind === "check" ? form.createCheckBox(w.name)
        : form.createRadioGroup(w.name);
      if (w.kind === "radio") {
        // The same value in two places turns on in both (RadiosInUnison); a
        // second click on the chosen circle clears it.
        field.acroField.setFlagTo(AcroButtonFlags.RadiosInUnison, true);
        field.enableOffToggling();
      }
      // The tooltip, which screen readers read as the field's name.
      field.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(w.tip));
      entry = { kind: w.kind, field, added: 0 };
      fields.set(w.name, entry);
    }

    const { field } = entry;
    if (w.kind === "radio") field.addOptionToPage(String(w.value), page, place);
    else field.addToPage(page, place);
    if (w.kind === "text" && !entry.added) {
      if (w.multiline) field.enableMultiline();
      field.setFontSize(w.size || 10.5);
    }
    const all = field.acroField.getWidgets();
    const widget = all[all.length - 1];
    // The tooltip on the widget too (some viewers read only the widget's); a
    // radio button's names its own choice.
    widget.dict.set(PDFName.of("TU"), PDFHexString.fromText(w.kind === "radio" ? `${w.tip} · ${w.label || w.value}` : w.tip));
    if (w.kind !== "text") looks.set(widget.dict, { look: w.look, mark: toPoints(w.mark || w.hit, height), value: w.value });
    entry.added++;
  }

  // Each tick box and circle gets its "on" and "off" looks. Widgets of the same
  // size and look share one pair, so a thousand circles cost a few streams.
  // A radio button's "on" state is named after its value (/1 to /5), with no
  // /Opt list: every widget for "3" is then the same choice, wherever it sits,
  // in any viewer. (pdf-lib numbers repeated options inconsistently past two
  // places.)
  const { context } = pdf;
  const shared = new Map();
  const appearance = (ops, width, height) => context.register(context.formXObject(ops, {
    BBox: context.obj([0, 0, width, height]), Matrix: context.obj([1, 0, 0, 1, 0, 0])
  }));
  for (const { kind, field } of fields.values()) {
    if (kind === "text") continue;
    if (kind === "radio") field.acroField.dict.delete(PDFName.of("Opt"));
    for (const widget of field.acroField.getWidgets()) {
      const { look, mark, value } = looks.get(widget.dict);
      const box = widget.getRectangle();
      const x = mark.x - box.x + mark.width / 2, y = mark.y - box.y + mark.height / 2;
      const r = Math.min(mark.width, mark.height) / 2;
      const key = [look, box.width, box.height, x, y, r].map(n => typeof n === "number" ? n.toFixed(2) : n).join(" ");
      if (!shared.has(key)) shared.set(key, { on: appearance(onLook(look, x, y, r), box.width, box.height), off: appearance([], box.width, box.height) });
      const { on, off } = shared.get(key);
      const normal = context.obj({});
      normal.set(kind === "radio" ? PDFName.of(String(value)) : widget.getOnValue(), on);
      normal.set(PDFName.of("Off"), off);
      widget.setNormalAppearance(normal);
      widget.removeDownAppearance();
    }
  }
  form.updateFieldAppearances();
  // The typing font, where the fields' /DA names it, so every viewer finds it.
  const font = form.getDefaultFont();
  form.acroForm.dict.set(PDFName.of("DR"), context.obj({ Font: { [font.name]: font.ref } }));
  dropUnreferenced(context);
  // Plain objects, not compressed object streams, so the file can be read and
  // audited with ordinary tools.
  return pdf.save({ useObjectStreams: false, updateFieldAppearances: false });
}

module.exports = { addFields, PT };
