# WildTrack RAD diagrams

| File | What it is |
|---|---|
| `context-diagram.puml` / `.png` | System context: WildTrack boundary (iPad app + server subsystems), actors, external systems, and interfaces IF-01 to IF-06 |
| `use-case-diagram.puml` / `.png` | UML use cases grouped by capability area, each labeled with the FR IDs it traces to |

The `.puml` files are the source of truth (diagrams as code). Re-render with PlantUML (`java -jar plantuml.jar -tpng *.puml`) or import into Astah or VS Code with the PlantUML plugin.

## Modeling decisions

- **System boundary:** the iPad app and the server are both part of WildTrack, so **IF-02 is an internal interface** between subsystems. The iPad hardware, iPadOS and MDM are external platform dependencies owned by State IT.
- **Interfaces vs. interactions:** only system-to-system connections (IF-01 to IF-06) appear in the spec's External Interfaces table; actor links show user interactions.
- **Offline sync is not a use case:** syncing (FR-08) is system behavior, not an actor goal, so it is part of *Submit report*.
- **Liaison review «extend»:** applies after supervisor approval, only when the report includes the poaching incident type (including multi-type reports). The return route on liaison rejection (FR-33) is an open customer decision.
