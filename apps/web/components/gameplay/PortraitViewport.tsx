"use client"

import {createContext,useCallback,useContext,useState,type ReactNode} from "react"

type Observe = (node: Element, onChange: (visible:boolean)=>void) => (()=>void) | undefined
const Portraits = createContext<Observe | null>(null)

export default function PortraitViewport({children}:{children:ReactNode}) {
  const [observe] = useState<Observe>(():Observe=>{
    const listeners=new Map<Element,(visible:boolean)=>void>()
    let observer:IntersectionObserver | undefined
    return (node,onChange)=>{
      if(typeof IntersectionObserver==="undefined"){onChange(true);return}
      observer??=new IntersectionObserver(entries=>{
        for(const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting)
      },{rootMargin:"10% 0%",scrollMargin:"10% 0%"})
      listeners.set(node,onChange)
      observer.observe(node)
      return ()=>{
        listeners.delete(node)
        observer?.unobserve(node)
        if(listeners.size===0){observer?.disconnect();observer=undefined}
      }
    }
  })
  return <Portraits value={observe}>{children}</Portraits>
}

export function usePortraitViewport() {
  const observe=useContext(Portraits)
  const [near,setNear]=useState(false)
  const ref=useCallback((node:HTMLSpanElement|null)=>{
    if(node) return observe?.(node,setNear)
  },[observe])
  return {ref,near:observe===null||near}
}
