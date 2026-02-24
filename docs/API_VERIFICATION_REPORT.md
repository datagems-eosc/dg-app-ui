# Raport weryfikacji API – Swagger vs dokumentacja vs implementacja

**Data:** 16 lutego 2025  
**Źródła:**
- [Swagger](https://datagems-dev.scayle.es/gw/swagger/index.html)
- [Data flows](https://datagems-eosc.github.io/dg-app-api/latest/data-flows/)
- [Onboarding / Postman](https://datagems-eosc.github.io/dg-app-api/latest/onboarding/)
- [Postman collection](https://datagems-eosc.github.io/dg-app-api/latest/content/DataGEMS.dg-app-api.postman-collection.json)

---

## 1. Onboarding flow

### 1.1 Upload plików

| Aspekt | Swagger/Docs | Implementacja |
|--------|--------------|---------------|
| Endpoint | `POST /api/storage/upload/dataset` | Zgodne (`uploadDatasetFiles`) |
| Format | `multipart/form-data`, pola `file1`, `file2`… | Zgodne |
| Odpowiedź | Tablica ścieżek staged | Obsługiwane (`stagedPath`) |

### 1.2 Onboard dataset

| Pole | Docs (PascalCase) | Nasz `onboardDataset` |
|------|-------------------|------------------------|
| Description | ✓ | ✓ |
| License | ✓ | ✓ |
| MimeType | ✓ | ✓ |
| Size | ✓ | ✓ |
| Url | ✓ | ✓ |
| DataLocations | Kind, **Location** | Kind, **Location** ✓ |
| CiteAs, ConformsTo | W docs | ✓ |

**Uwaga z piotr.sikora:** Metadane (url, mimeType, size) są **w całości podawane przez użytkownika**. Brak automatycznego wyciągania z uploadu.

Różnica Postman vs docs: w Postman `DataLocations` ma pole `url`, w docs – `Location`. **Nasza implementacja używa `Location`** – zgodnie z docs.

### 1.3 Profilowanie

- Endpoint: `POST /api/dataset/profile`
- Body: `{ "id": "<uuid>", "dataStoreKind": 0 }` (0 = FileSystem)
- Zgodne z implementacją.

---

## 2. User Group Query

### 2.1 Endpoint

- **Swagger:** `POST /api/user/group/query`
- **Full URL:** `{baseUrl}/gw/api/user/group/query`
- **Implementacja:** `NEXT_PUBLIC_USER_GROUPS_ENDPOINT` lub `/user/group/query` ✓

### 2.2 Schemat UserGroupLookup (Swagger)

```
ids?: string[] | null
excludedIds?: string[] | null
semantics?: string[] | null
like?: string | null     // Limit lookup to items whose name matches the pattern
page?: Paging            // offset, size (camelCase w OpenAPI)
order?: Ordering         // items (camelCase w OpenAPI)
metadata?: Header        // countAll
project?: FieldSet       // fields
```

### 2.3 Różnica Postman vs Swagger

Kolekcja Postman używa **PascalCase** dla zapytań:

```json
{
  "page": { "Offset": 0, "Size": 10 },
  "Order": { "Items": ["+code"] },
  "Metadata": { "CountAll": true }
}
```

Swagger/OpenAPI ma **camelCase** (`offset`, `size`, `items`), ale backend (.NET) w praktyce może oczekiwać PascalCase.

### 2.4 Obecny payload

```ts
queryUserGroups(search.trim() ? { like: search.trim() } : {})
```

**Uwaga:** Endpoint zwraca 102 Validation Error dla Page/Order - NIE wysyłać tych pól.


---

## 3. Context grants (przypisanie grup do datasetu)

| Aspekt | Swagger | Implementacja |
|--------|---------|----------------|
| Endpoint | `POST /api/principal/context-grants/group/{groupId}/dataset/{datasetId}/role/{role}` | ✓ `assignGroupDatasetGrant` |
| Usuwanie | `DELETE` ten sam path | ✓ `unassignGroupDatasetGrant` |

---

## 4. Rekomendacje

1. **`queryUserGroups`** – minimalny payload: `{}` lub `{ like: "fraza" }`; NIE wysyłać `page` ani `Order` (backend zwraca Validation Error)
2. **Onboarding** – obecna implementacja jest zgodna z docs.
3. **Debugowanie grup** – sprawdzić w Network Tab:
   - status HTTP
   - body requestu i response
   - czy backend zwraca 401/403 (autoryzacja/uprawnienia).
