export enum SortTeaByPrice {
  ASCENDING = 'ascending',
  DESCENDING = 'descending',
}

export const LabelToValue: Record<string, SortTeaByPrice> = {
  'Tăng dần': SortTeaByPrice.ASCENDING,
  'Giảm dần': SortTeaByPrice.DESCENDING,
};
