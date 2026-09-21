export function tabId(tabsId: string, value: string): string {
  return `${tabsId}-tab-${value}`;
}

export function tabPanelId(tabsId: string, value: string): string {
  return `${tabsId}-panel-${value}`;
}
