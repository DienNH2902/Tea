export enum SortTeaByPrice {
  ASCENDING = 'ascending',
  DESCENDING = 'descending',
}

// Nhãn hiển thị trên swagger
export const LabelToValue: Record<string, SortTeaByPrice> = {
  'Giá tăng dần': SortTeaByPrice.ASCENDING,
  'Gía giảm dần': SortTeaByPrice.DESCENDING,
};
