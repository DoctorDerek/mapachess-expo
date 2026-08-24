declare const createMachine: <TConfiguration>(
  configuration: TConfiguration,
) => TConfiguration

export const xstateDiffCalibrationMachine = createMachine({
  id: "xstateDiffCalibration",
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "running",
      },
    },
    running: {
      on: {
        RESET: "idle",
      },
    },
  },
})
