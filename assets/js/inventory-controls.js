const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

export function filterAndSortInventory(entries, query = "", sort = "source") {
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const matchingEntries = entries.filter(({ item }) => item.description.toLocaleLowerCase("fr").includes(normalizedQuery));

  return matchingEntries.sort((left, right) => {
    if (sort === "name") return collator.compare(left.item.description, right.item.description);
    if (sort === "quantity") return right.item.qty - left.item.qty || collator.compare(left.item.description, right.item.description);
    return left.index - right.index;
  });
}
