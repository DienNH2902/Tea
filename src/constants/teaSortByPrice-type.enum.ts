export enum SortTeaByPrice {
  ASCENDING = 'ascending',
  DESCENDING = 'descending',
}

export const LabelToValue: Record<string, SortTeaByPrice> = {
  'Giá tăng dần': SortTeaByPrice.ASCENDING,
  'Gía giảm dần': SortTeaByPrice.DESCENDING,
};
