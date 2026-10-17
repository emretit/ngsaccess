/** Count every matching row without retaining documents or truncating totals. */
export async function countDashboardRows(rows: AsyncIterable<unknown>): Promise<number> {
  let count = 0;
  for await (const row of rows) {
    void row;
    count += 1;
  }
  return count;
}
