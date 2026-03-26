-- PROJ-19: Teams-Benachrichtigung nach Lauf-Eintrag
-- Tabelle fuer motivierende Nachrichten-Templates

CREATE TABLE IF NOT EXISTS teams_messages (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security aktivieren
ALTER TABLE teams_messages ENABLE ROW LEVEL SECURITY;

-- Nur serverseitig per Service Role Key lesbar (kein Client-Zugriff noetig).
-- Service Role umgeht RLS automatisch, daher brauchen wir keine permissive Policy.
-- Stattdessen: keine Policy fuer anon/authenticated = kein Zugriff ueber Client-SDKs.
-- Admins koennen im Supabase Dashboard direkt bearbeiten (Dashboard nutzt Service Role).

-- Index auf active-Spalte fuer schnelle Abfrage aktiver Nachrichten
CREATE INDEX idx_teams_messages_active ON teams_messages (active) WHERE active = true;

-- 30 vordefinierte Nachrichten-Templates einfuegen
INSERT INTO teams_messages (message) VALUES
  ('🚀 Nicht SpaceX, sondern {name} hat am {datum} den Launch der Woche hingelegt und ist {km} km gelaufen!'),
  ('🏃‍♀️ {name} war am {datum} unterwegs und hat {km} km in die Beine gepackt – wer läuft, kommt weiter!'),
  ('🔥 Heiß wie Asphalt im Juli: {name} hat am {datum} {km} km abgefackelt. BettercallPaul brennt!'),
  ('🦵 {name}s Beine dachten am {datum}, sie hätten frei. Irrtum – {km} km später wissen sie es besser.'),
  ('🥇 Podium oder nicht – {name} hat am {datum} {km} km gelaufen und das zählt. Ende, Aus, Basta!'),
  ('🌟 Heute ist {name} der Star: {datum}, {km} km, volle Punkte vom Kampfgericht BettercallPaul!'),
  ('😅 Laufen ist wie Fliegen, nur schwitziger. {name} weiß das – {km} km am {datum} ohne Business Class.'),
  ('🎸 Rock''n''Roll auf dem Asphalt! {name} hat am {datum} {km} km rausgehauen. Das Team wippt mit!'),
  ('🍕 {km} km am {datum} – {name} hat sich damit offiziell {km} Pizzastücke verdient. Mathematisch erwiesen.'),
  ('🦸 Nicht alle Held*innen tragen Umhänge. {name} trägt Laufschuhe und hat am {datum} {km} km bewiesen.'),
  ('🐝 {name} war am {datum} fleißig wie eine Biene und hat {km} km gesummt. Respekt, fleißige Biene!'),
  ('🌈 {name} hat am {datum} {km} km lächelnd absolviert – nach dem Lauf kommt bekanntlich der Kuchen!'),
  ('🤖 KI kann vieles simulieren – aber {name}s {km} km am {datum}? Die hat kein Algorithmus gelaufen!'),
  ('🌊 Flow-State aktiviert: {name} ist am {datum} {km} km im absoluten Hochgefühl dahingeflossen!'),
  ('🏔️ {name} hat am {datum} {km} km erklommen – jeder Kilometer ein Gipfelsturm. Bergsteiger*in des Tages!'),
  ('🦩 Elegant wie ein Flamingo, ausdauernd wie ein Ochse: {name} am {datum} mit {km} km. Perfekte Kombi!'),
  ('🎯 {name} hat am {datum} {km} km ins Schwarze getroffen. Das nächste Ziel wartet schon ungeduldig.'),
  ('🧠 Studien zeigen: Läufer*innen sind klüger. {name} beweist das am {datum} mit {km} km. Sehr klug.'),
  ('🎭 Drama! {name}s Beine wollten am {datum} eigentlich Pause. {km} km später: Aussöhnung erreicht.'),
  ('💃 {name} hat am {datum} {km} km gelaufen und darf heute Abend ausdrücklich tanzen. Regeln sind Regeln.'),
  ('🌍 {km} km am {datum} – {name} verbessert Schritt für Schritt die Welt. Zumindest die eigene Kondition.'),
  ('⚡ Blitz auf Schuhen: {name} hat am {datum} {km} km abgespult. Wer kann da noch mithalten?'),
  ('🦊 Schlau genug um zu starten, stark genug um durchzuhalten: {name} am {datum} mit {km} km.'),
  ('🍦 {name} hat am {datum} {km} km abgeleistet – das Eis danach ist keine Schwäche, das ist Sporternährung.'),
  ('🏋️ Andere heben Gewichte. {name} hebt am {datum} {km} km auf das Teamkonto. Stärker geht nicht!'),
  ('🐢 Schnell oder gemütlich – {name} war am {datum} unterwegs und hat {km} km abgeliefert. Hauptsache dabei!'),
  ('🌞 {name} hat am {datum} {km} km in die Sonne gelaufen. Das Team blendet vor Stolz!'),
  ('🎉 Achtung, Neuigkeit: {name} hat am {datum} {km} km absolviert – ein weiterer Schritt für BettercallPaul!'),
  ('💪 {name} am {datum}: {km} km. Kilometer für Kilometer näher am wohlverdienten Feierabend-Eis!'),
  ('🏅 Medaillenverdächtig! {name} hat am {datum} {km} km ins Ziel gebracht. Das Treppchen ist nur eine Frage der Zeit.');
