export enum TeaAvailabilityFilter {
  ALL = 'ALL', // Lấy tất cả (Cả 2)
  AVAILABLE = 'AVAILABLE', // Chỉ còn hàng (isAvailable: true)
  OUT_OF_STOCK = 'OUT_OF_STOCK', // Hết hàng (isAvailable: false)
}
