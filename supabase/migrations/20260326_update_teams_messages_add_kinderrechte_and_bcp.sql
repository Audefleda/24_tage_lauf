-- PROJ-19: Kaputten Satz fixen + 30 neue Nachrichten (15 Kinderrechte, 15 BCP)

-- Fix: "in die Sonne gelaufen" ergibt keinen Sinn
UPDATE teams_messages
SET message = '🌞 {name} ist am {datum} {km} km gelaufen und hat dabei sogar die Sonne beschämt. Das Team strahlt vor Stolz!'
WHERE message = '🌞 {name} hat am {datum} {km} km in die Sonne gelaufen. Das Team blendet vor Stolz!';

-- 15 neue Sätze: 24-Tage-Lauf für Kinderrechte (Stuttgarter Kinderstiftung)
INSERT INTO teams_messages (message) VALUES
  ('🧒 {name} läuft am {datum} {km} km – jeder Schritt ein Statement für Kinderrechte. Stuttgart hört hin!'),
  ('🌍 {km} km am {datum}: {name} macht Kinder sichtbar – nicht mit Worten, sondern mit Schuhsohlen!'),
  ('📚 Recht auf Bildung, Recht auf Schutz, Recht auf {name}s Einsatz: {km} km am {datum} für die Stuttgarter Kinderstiftung!'),
  ('🎯 24 Tage, unendlich viele Gründe zu laufen. {name} liefert am {datum} {km} km – für Kinder, die es zählen!'),
  ('🏃 {name} hat am {datum} {km} km für Kinder gelaufen, die noch keine Stimme haben. Laut laufen statt still stehen!'),
  ('💙 Für jeden Kilometer, den {name} am {datum} läuft, wächst die Chance eines Kindes auf eine bessere Zukunft.'),
  ('🧡 {name} am {datum}: {km} km im Dienst der UN-Kinderrechtskonvention. Artikel 1 bis 54 – alle wurden angelaufen!'),
  ('🏙️ Stuttgart soll hören! {name} hat am {datum} {km} km Aufmerksamkeit für Kinder in unserer Stadt erzeugt.'),
  ('🌱 Klein anfangen, groß rauskommen: {name} hat am {datum} {km} km in die Zukunft von Stuttgarter Kindern investiert.'),
  ('🎗️ Keine Bestzeit nötig – {name} hat am {datum} {km} km für den guten Zweck absolviert. Das ist die echte Medaille!'),
  ('🤝 Die Jugendjury wählt, {name} läuft: {km} km am {datum}, damit Förderprojekte wirklich ankommen.'),
  ('💰 {km} km am {datum} sind nicht nur Ausdauer – jeder Meter bringt Spendengelder für Kinder in Stuttgart.'),
  ('🛡️ Schutz vor Diskriminierung ist kein Sprint, sondern ein Marathon. {name} hat am {datum} {km} km dazu beigetragen!'),
  ('🌟 {name} läuft am {datum} {km} km für Kinder, die ihr Recht auf Bildung noch erkämpfen müssen. Danke!'),
  ('🕐 24 Tage, 20. April bis 14. Mai – {name} ist am {datum} mit {km} km dabei. Kein Tag ohne Kilometer!'),

-- 15 neue Sätze: BettercallPaul / bcxp.de
  ('🤖 {name} hat am {datum} {km} km trainiert – das nächste ML-Modell trainiert sich schließlich auch nicht von allein!'),
  ('🐛 Bug im Code? {name} debuggt am {datum} {km} km auf dem Asphalt. Manche Fehler löst man nur im Laufrausch.'),
  ('🎯 Individuelle und einzigartige Laufleistung: {name} am {datum} mit {km} km – wie unsere Softwarelösungen!'),
  ('📊 Data Science says: {name}s Laufkurve zeigt am {datum} stolze {km} km. Die KI ist beeindruckt!'),
  ('🏙️ München, Stuttgart, Berlin – und {name} läuft am {datum} {km} km. BettercallPaul is everywhere!'),
  ('⚖️ Better Call Paul? Besser noch: Better Call {name}! {km} km am {datum} – Saul Goodman hätte das nie gemacht.'),
  ('🧪 Machine Learning oder gutes altes Laufen? {name} setzt am {datum} auf {km} km echte Kilometer – keine Simulation!'),
  ('🤝 Wir halten zusammen ohne Wenn und Aber – {name} hält am {datum} durch: {km} km. BCP-Teamgeist in Bestform!'),
  ('🚀 Deploy successful: {name} hat am {datum} {km} km in Production gebracht. Keine Bugs, kein Rollback nötig!'),
  ('🧑‍💻 Sprint abgeschlossen! {name} liefert am {datum} {km} km. Velocity: außerordentlich. Stakeholder: begeistert.'),
  ('📈 KPIs grün: {name} am {datum} mit {km} km. Das Management ist zufrieden. Die Beine eher weniger.'),
  ('☕ Kaffee rein, Code raus – und zwischendurch: {name} läuft am {datum} {km} km. Work-Life-Balance auf BCP-Art.'),
  ('🎓 Vom Study zum Expert: {name} hat am {datum} {km} km Level-Up gemacht. Nächstes Karriereziel: Ultraläufer*in.'),
  ('💻 {name} schreibt nicht nur eleganten Code, sondern auch Kilometer: {km} am {datum}. Full-Stack in jeder Hinsicht!'),
  ('🦸 {name} ist unser einzigartiger Mensch des Tages: {km} km am {datum}. Erfolgreiche Teams brauchen solche Leute!');
