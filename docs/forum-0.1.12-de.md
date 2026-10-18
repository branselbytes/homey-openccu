# Forenentwurf für Beta 0.1.12

Nach bestätigter Homey-Testveröffentlichung verwenden:

Die neue **Beta 0.1.12** ist verfügbar. Danke für eure Rückmeldungen!

Kurzer Changelog:

- Unvollständig eingelesene Gerätebeschreibungen entfernen keine bestehenden Gerätefunktionen mehr. Fehlende Beschreibungen werden automatisch nachgeladen; betroffene Zuordnungen können ohne erneutes Anlernen wiederhergestellt werden.
- Geräte können nach „OpenCCU command delivery could not be verified“ durch neue Rückmeldungen oder automatische Leseabfragen wieder verfügbar werden. Fahrbefehle werden dabei nicht erneut gesendet.
- Verspätete Prüffehler nach einem neueren Befehl oder Neustart werden ignoriert.
- Sirenenbeschriftung „Außenhaut-Alarm“ verständlicher als „Alarm der Außenüberwachung“ benannt.

Die passenden Fehlerfälle sind in automatisierten Tests abgesichert. Ob damit auch die Ausfälle in euren konkreten Installationen vollständig behoben sind, müssen wir noch gemeinsam prüfen.

**@DirkG:** Bleiben Griffposition, Batterieanzeige und die „Griff ist offen“-Flow-Karten mit aktiviertem **BidCos-RF** erhalten, auch nach einem App-Neustart? Funktioniert gleichzeitig die HM-Sec-Sir-WM? Bitte zunächst ohne Löschen und erneutes Anlernen testen; das Nachladen kann einige Minuten dauern.

**@chrb:** Funktionieren deine drei **HmIP-BROLL-2** mit dem bisherigen Flow und jeweils einer Sekunde Abstand auch am nächsten Morgen? Ist BidCos-RF aktiviert, und funktioniert der HM-PB-2-FM weiterhin?

Falls ein Fehler erneut auftritt: Bitte **vor einem Neustart oder dem Umschalten von BidCos-RF** einen Diagnosebericht erstellen und App-/Homey-/OpenCCU-Version, Gerätemodell/Firmware, ungefähre Uhrzeit und die genaue Fehlermeldung nennen. Die kurze Diagnosezusammenfassung passt ins Forum; den vollständigen bereinigten JSON-Bericht bei Bedarf an ein GitHub-Issue anhängen. Berichte bitte vor dem Teilen auf private Angaben prüfen.
