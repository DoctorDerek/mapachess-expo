"use client"

import { createContext, useContext } from "react"
import {
  DEFAULT_COACH_COLLECTION,
  type CoachCollectionId,
} from "@mapachess/match-presentation/coach-portrait"

const CoachCollectionContext = createContext<CoachCollectionId>(
  DEFAULT_COACH_COLLECTION,
)

export const useCoachCollection = (): CoachCollectionId =>
  useContext(CoachCollectionContext)

export default CoachCollectionContext
