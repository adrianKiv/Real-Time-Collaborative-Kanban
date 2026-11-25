import { useEffect, useRef, useState } from 'react'
import { tokenStore } from '../api/axios.js'

const INITIAL_RETRY_DELAY = 500
const MAX_RETRY_DELAY = 15000
const STABLE_CONNECTION_MS = 10000

export default function useBoardWebSocket(boardId, onEvent) {
  const [isLive, setIsLive] = useState(false)
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!boardId) {
      setIsLive(false)
      return undefined
    }

    let socket
    let reconnectTimer
    let stableTimer
    let retryCount = 0
    let cancelled = false

    function connect() {
      if (cancelled) return

      const token = tokenStore.get()
      if (!token) {
        setIsLive(false)
        return
      }

      const baseUrl = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080').replace(/\/+$/, '')
      const url = new URL(`${baseUrl}/ws/boards/${boardId}`)
      url.searchParams.set('token', token)

      setIsLive(false)
      socket = new WebSocket(url)

      socket.addEventListener('open', () => {
        setIsLive(true)
        stableTimer = window.setTimeout(() => {
          retryCount = 0
        }, STABLE_CONNECTION_MS)
      })

      socket.addEventListener('message', (message) => {
        try {
          const event = JSON.parse(message.data)
          if (event && typeof event.event === 'string') onEventRef.current?.(event)
        } catch (error) {
          console.error('Unable to parse board websocket event', error)
        }
      })

      socket.addEventListener('close', () => {
        setIsLive(false)
        window.clearTimeout(stableTimer)
        if (cancelled) return

        const delay = Math.min(INITIAL_RETRY_DELAY * 2 ** retryCount, MAX_RETRY_DELAY)
        retryCount += 1
        reconnectTimer = window.setTimeout(connect, delay)
      })

      socket.addEventListener('error', () => {
        socket.close()
      })
    }

    connect()

    return () => {
      cancelled = true
      window.clearTimeout(reconnectTimer)
      window.clearTimeout(stableTimer)
      socket?.close()
    }
  }, [boardId])

  return { isLive }
}
