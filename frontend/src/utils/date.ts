export const isValidDate = (date: unknown): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const parseDate = (dateValue: unknown): Date | null => {
  if (dateValue === null || dateValue === undefined) {
    return null;
  }
  
  if (dateValue instanceof Date) {
    return isValidDate(dateValue) ? dateValue : null;
  }
  
  if (typeof dateValue === 'string') {
    if (dateValue.trim() === '') {
      return null;
    }
    const date = new Date(dateValue);
    return isValidDate(date) ? date : null;
  }
  
  if (typeof dateValue === 'number') {
    const date = new Date(dateValue);
    return isValidDate(date) ? date : null;
  }
  
  return null;
};

export const formatDate = (dateValue: unknown): string => {
  const date = parseDate(dateValue);
  
  if (!date) {
    return '-';
  }
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString('zh-CN');
};

export const formatDateShort = (dateValue: unknown): string => {
  const date = parseDate(dateValue);
  
  if (!date) {
    return '-';
  }
  
  return date.toLocaleDateString('zh-CN');
};
