import { createContext, useContext, useEffect } from 'react'

// Lets a PAGE talk to the frame around it (AppShell) without passing props up:
//   useCommands(provider)   what the Ctrl+K palette offers on this page
//   useShellInfo({...})     the name in the top bar and the bell's alert count
export const ShellContext = createContext(null)

// provider(query) returns a list of { id, label, hint, icon, run } (or a Promise of one).
// Kept in a ref, so updating it on every render costs nothing.
export function useCommands(provider) {
  const shell = useContext(ShellContext)
  useEffect(() => {
    if (shell) shell.commandsRef.current = provider
  })
  useEffect(() => () => {
    if (shell) shell.commandsRef.current = null
  }, [shell])
}

// info = { displayName, alert: { count, label, onClick } }
export function useShellInfo(info) {
  const shell = useContext(ShellContext)
  const key = JSON.stringify({ name: info.displayName, count: info.alert?.count, label: info.alert?.label })
  useEffect(() => {
    shell?.setInfo(info)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => () => shell?.setInfo({}), [shell])
}

export function useShell() {
  return useContext(ShellContext)
}
