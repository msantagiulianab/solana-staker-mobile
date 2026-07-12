import { useThemeColor } from '@/hooks/use-theme-color'

export function useWalletUiTheme() {
  return {
    backgroundColor: useThemeColor({}, 'background'),
    borderColor: useThemeColor({}, 'border'),
    textColor: useThemeColor({}, 'text'),
  }
}