\\ Kesy2.0 documentatie
# Kennissysteem (KESY) 2.0
## Speciale invoer
### Dynamische CSV-invoer
#### Idee
Binnen Kesy 2.0 wil ik proberen een module te maken waarmee ik gegevens-invoer via een CSV-bestand op een meer generieke manier kan regelen. Het idee is dat ik per CSV-kolom in een datatabel aangeef welke anctie nodig zijn. Daardoor hoef ik niet voor relatief simpele CSV-structuren steeds nieuwe invoermodules te coderen.
Als eerste voorbeeld heb ik de volgende CSV-structuur:
"Insectendoos_label";"Insectendoos_toelichting";"Geslacht";"Soort";"Aantal"
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Oxytelus";"rugosus";13
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Oxytelus";"insectatus";2
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Oxytelus";"fulvipes";1
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Tanycraerus";"laequeatus";11
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Caccoporus";"piceua";1
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Epomotylus";"sculptus";6
...
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Blediodes";"opacus";4
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Blediodes";"atricapillus";3
"15-01: 17.10.5 L ";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 4";"Blediodes";"nanus";2
;;;;
"15-02: 17.10.6L";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 5";"Blediodes";"fracticornis";8
"15-02: 17.10.6L";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 5";"Blediodes";"femoralis";1
"15-02: 17.10.6L";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 5";"Blediodes";"procerulus";1
"15-02: 17.10.6L";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 5";"Blediodes";"crassicollis";1
"15-02: 17.10.6L";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 5";"Blediodes";"occidentalis";1
"15-02: 17.10.6L";"Natuurmuseum, Enschede - Coleoptera Nederland - Staphylinidae 5";"Blediodes";"cribricollis";1
...
De bedoeling is dat per record de volgende stappen worden gezet:
1. Kolom 1: checken of het object met label: "Insectendoos: " + inhoud kolom 1 al bestaat, 
   zo ja: object_id bewaren als DoosId, 
   zo nee, nieuw object aanmaken 
      met label: "Insectendoos: " + inhoud kolom 1 
      met dit object als target een relatie "is objecttype" leggen met de source "Object type: Insectendoos" (ID: 019fcd20-b442-755f-af50-9cdf9716990d)
      dit object krijgt een koppeling met de parameter "Toelichting" met als parameter_waarde de inhoud van kolom 2
      de object_id wordt bewaard als DoodId,
2. Kolom 3 en 4 worden met een spatie ertussen samengevoegd tot de Soortnaam; Hiervoor wordt een nieuw object aangemaakt
   met als label: "Specimen groep: " samengevoegd met de Soortnaam.
   Dit nieuwe object wordt als target aan de DoosId gekoppeld met een relatietype "ligt/zit in of op" 
   Dit nieuwe object krijgt als target een relatie "is objecttype" met de source "Object type: Specimengroep" (ID: 019fcd20-b56f-76ae-9bf0-f98a0354b7ca)
   Dit nieuwe object krijgt een koppeling met de parameter "Aantal" met als parameter_waarde de inhoud van kolom 5

#### Gekozen opzet
We gaan werken aan een <b>CSV Mapping Configuration Engine</b>. Daarbij kiezen we ervoor de Metadata die we nodig hebben in een Metadata Header aan de CSV mee te geven
De verwerking in Next.js bestaat uit 3 lagen:
- Parser & Cleaner (src/lib/csvParser.ts)
    - Leest de header uit (#).
    - Parst de JSON-configuratie.
    - Filtert lege of ongeldige regels zoals ;;;; en stript spaties rondom teksten (trim()).
- In-Memory Caching & Executor (src/lib/importExecutor.ts)
    - Bepaalt of een parent-object (zoals de Insectendoos) al in de lokale cache of database bestaat. Zo niet, dan maakt hij deze aan.
    - Maakt het child-object aan en legt de relaties en parameters aan.
- UI Preview & Execution Component (app/import/page.tsx)
    - Toont een Preview: "3 unieke dozen gevonden, 14 specimengroepen te importeren".
    - Bevat de knop "Voer Import Uit".

Met deze specifieke vertrouwelijkheidsregels kunnen we dit elegant inbouwen:
- CSV-niveau: We voegen een optionele instelling isConfidential toe aan de metadata-header (standaard false).
- Afgeleide Vertrouwelijkheid:
    - Object: Neemt isConfidential van de import-instelling over.  
    - ParameterValue: Wordt vertrouwelijk als het bijbehorende object vertrouwelijk is (isConfidential = parentIsConfidential).  
    - RelationValue: Wordt vertrouwelijk als source OF target (of beiden) vertrouwelijk is (isConfidential = sourceIsConfidential || targetIsConfidential).

relatietype "is objecttype" heeft Id:019fcdd3-721a-7512-b755-cddd67f43eb6
parameter "Toelichting" heeft Id: 019fc74c-cf8c-74ff-a3b6-b6d21c651a19
relatie "ligt/zit in of op" heeft Id: 019fad01-ca30-769d-8c9c-6fc70fa9db0a
parameter "Aantal" heeft Id: 019fad6f-c149-7795-b3e5-751c8b2b7949