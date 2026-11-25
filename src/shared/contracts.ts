export type GameId = 'counting' | 'shadow' | 'connect'
export type ThemeId = 'farm' | 'fruit' | 'sea' | 'vegetable' | 'school'
export type Level = 1 | 2 | 3 | 4 | 5

export interface Settings {
  game: GameId
  theme: ThemeId
  level: Level
  minutes: 5 | 10 | 15
  roundLimit: number
  audio: boolean
  reducedMotion: boolean
}

export interface Asset {
  id: string
  theme: ThemeId
  image: string
  labelVi: string
}

export interface GameProps {
  settings: Settings
  assets: readonly Asset[]
  active: boolean
  roundKey: string
}

export type Rng = () => number
