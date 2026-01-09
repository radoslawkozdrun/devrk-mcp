# Example Workflow Skill

## Opis

Ten skill demonstruje jak łączyć wiele narzędzi w workflow wyższego poziomu. Skills są używane do implementacji złożonych operacji, które wymagają koordynacji wielu narzędzi.

## Kiedy używać

Użyj tego skilla jako wzorca gdy potrzebujesz:
- Wykonać serię powiązanych operacji
- Przetworzyć dane przez wiele narzędzi
- Zaimplementować złożony przepływ biznesowy
- Agregować wyniki z różnych źródeł

## Przykłady wywołania

```typescript
import { exampleWorkflow } from './skills/example-workflow';

// Przykład 1: Podstawowe wywołanie
const result = await exampleWorkflow({
  names: ['Alice', 'Bob', 'Charlie'],
  language: 'en'
});

// Przykład 2: Z własnym językiem
const result = await exampleWorkflow({
  names: ['Anna', 'Jan'],
  language: 'pl'
});
```

## Wymagane serwery

- `example` - do generowania przywitań

## Zwracane dane

```typescript
{
  greetings: string[];        // Lista wygenerowanych przywitań
  count: number;              // Liczba przywitań
  timestamp: string;          // Timestamp operacji
}
```
