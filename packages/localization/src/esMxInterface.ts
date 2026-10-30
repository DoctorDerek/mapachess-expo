import type { MapachessCatalog } from "./catalog.js"

const interfaceCopy = {
  betterHintsControl: { betterHints: "Mejores pistas" },
  challengeDifficultyChoices: { elo: "Elo" },
  chessArtwork: {
    selectedChessArtworkCouldNotLoadDefaults:
      "No se pudo cargar el diseño de ajedrez seleccionado. Se muestran los diseños predeterminados; tus elecciones y tu partida se conservan.",
    retryChessArtwork: "Reintentar cargar el diseño de ajedrez",
  },
  classifiedMoveHistory: {
    moveHistory: "Historial de jugadas",
    noMovesYet: "Todavía no hay jugadas.",
  },
  mapachitoCoachPortrait: {
    artworkUnavailable: "Imagen no disponible.",
    retryArtwork: "Reintentar cargar la imagen",
  },
  matchCelebration: {
    opponentResigned: "El oponente se rindió.",
    storyComplete: "¡Historia completada!",
    reviewBoard: "Revisar tablero",
  },
  matchCommands: {
    undo: "Deshacer",
    redo: "Rehacer",
    matchMenu: "Menú de partida",
    menu: "Menú",
    offerDraw: "Ofrecer tablas",
    resign: "Rendirse",
  },
  matchOutcome: { matchResult: "Resultado de la partida" },
  matchRecovery: {
    retryEvaluation: "Reintentar evaluación",
    yourPendingChangeIsRetainedButNot:
      "Tu cambio sigue aquí, pero aún no está guardado. Elige Reintentar guardado para continuar.",
    retrySave: "Reintentar guardado",
  },
  matchSaveConfirmation: { savedLocally: "Guardado localmente" },
  positionEvaluationGutter: { stockfishEvaluation: "Evaluación de Stockfish" },
  reactiveBattleStage: { reactiveBattleStage: "Escenario de batalla reactivo" },
  storyMatchResult: {
    storyResult: "Resultado de Historia",
    storyComplete: "¡Historia completada!",
    yourStoryProgressIsUnchanged: "Tu progreso de Historia no cambió.",
    openingSetup: "Abriendo configuración…",
    nextOpponent: "Siguiente oponente",
    storyLadder: "Progresión de Historia",
    replayOpponent: "Jugar de nuevo",
    chooseYourSettingsBeforePlayingAgain:
      "Elige tu configuración antes de volver a jugar.",
  },
  webGame: {
    settings: "Configuración",
    resumeMatch: "Reanudar partida",
    restartMatch: "Reiniciar partida",
    returnToMenu: "Volver al menú",
    replayOpponent: "Jugar de nuevo",
    yourLastVerifiedLocalProfileRemainsAvailable:
      "Tu último guardado local verificado sigue disponible. Elige Reintentar para repetir la acción interrumpida.",
    retry: "Reintentar",
  },
  webMatch: {
    coreMatchActions: "Acciones principales de la partida",
    matchDetailsMoveHistory: "Detalles de la partida e historial de jugadas",
    currentMatchData: "Datos de la partida actual",
    mode: "Modo",
    clock: "Reloj",
    untimed: "Sin reloj",
    privacy: "Privacidad",
    localAccountless: "Local · Sin cuenta",
    engine: "Motor",
    viewRewards: "Ver recompensas",
  },
  inputBindingSettings: {
    controls: "Controles",
    changesApplyOnlyAfterSaveSucceedsTab:
      "Los cambios solo se aplican si se guardan correctamente al elegir Guardar controles. Tab y los atajos de la plataforma conservan su funcionamiento normal.",
    restoreDefaults: "Restaurar valores predeterminados",
    cancel: "Cancelar",
    saveControls: "Guardar controles",
    cancelSwap: "Cancelar intercambio",
    swapBindings: "Intercambiar asignaciones",
    chooseThePhysicalControlYourSavedControls:
      "Elige el botón o la dirección del control. Tus controles guardados siguen sirviendo para navegar por este selector.",
    removeBinding: "Quitar asignación",
    pressAKey: "Presiona una tecla",
    escapeClosesWithoutChangesToBindEscape:
      "Escape cierra sin cambios. Para asignar Escape explícitamente, usa esta opción:",
    useEscape: "Usar Escape",
    cancelBindingChange: "Cancelar cambio de asignación",
  },
  localSaveError: { localSaveError: "Error de guardado local" },
  mapachessLoadingSurface: { loadingMapachess: "Cargando Mapachess." },
  recoverableView: { tryAgain: "Intentar de nuevo" },
  chessAppearanceChoices: {
    boardPieces: "Tablero y piezas",
    pieces: "Piezas",
    board: "Tablero",
  },
  coachCollectionChoices: {
    coach: "Entrenador",
    oneRaccoonOrACastOfAnimals:
      "Un mapache o un elenco de animales cuyas expresiones siguen la partida.",
  },
  moveClassificationFaq: {
    howAreMovesClassified: "¿Cómo se clasifican las jugadas?",
    closeMoveClassifications: "Cerrar clasificaciones de jugadas",
  },
  playerAnimalChoices: {
    playAs: "Juega como",
    beatAnimalsInStoryToUnlockThem:
      "Derrota animales en Historia para desbloquearlos. Mapache siempre es tuyo.",
    playerAnimals: "Animales del jugador",
    locked: "Sin desbloquear",
    selected: "Selección actual",
  },
  profileCard: {
    profileArtworkCouldNotLoad: "No se pudo cargar la imagen del perfil.",
    retryArtwork: "Reintentar cargar la imagen",
  },
  profileCardJourney: {
    back: "Atrás",
    keepYourAppearanceChanges:
      "¿Conservar los cambios de tu tarjeta de perfil?",
    keepEditing: "Seguir editando",
    saveAppearance: "Guardar cambios",
    discardChanges: "Descartar cambios",
    theProfileCardPreviewCouldNotBe:
      "No se pudo mostrar la vista previa de la tarjeta de perfil.",
    yourAppearanceChangesAreStillHereTry:
      "Los cambios de tu tarjeta de perfil siguen aquí. Intenta de nuevo o usa Atrás para volver.",
    customizationCouldNotBeDisplayed: "No se pudo mostrar la personalización.",
    yourAppearanceChangesAreStillHereTry2:
      "Los cambios de tu tarjeta de perfil siguen aquí. Intenta de nuevo para seguir editando.",
  },
  profileCardPreview: {
    imageFormat: "Formato de imagen",
    includeInYourProfileCard: "Incluir en tu tarjeta de perfil",
    previewingUnsavedAppearanceImageExportDoesNot:
      "Vista previa de cambios sin guardar. Exportar la imagen no guarda tus cambios.",
    imagePreparationFailedYourAppearancePreviewChoices:
      "No se pudo preparar la imagen. Tu apariencia, las opciones de vista previa y tu partida no cambiaron.",
  },
  profileDressingRoom: {
    saveAppearance: "Guardar cambios",
    shareProfileCard: "Compartir tarjeta de perfil",
    cancelChanges: "Cancelar cambios",
    appearanceCouldNotBeSavedLocallyYour:
      "No se pudieron guardar los cambios de tu tarjeta de perfil en este dispositivo. Tus cambios siguen aquí.",
    retrySave: "Reintentar guardado",
    appearanceCategories: "Categorías de apariencia",
    color: "Color",
    cancel: "Cancelar",
    save: "Guardar",
    share: "Compartir",
    backToCategories: "Volver a categorías",
    customizeAppearance: "Personaliza tu apariencia",
  },
  profileFoundation: {
    readingBackup: "Leyendo respaldo…",
    importBackup: "Importar respaldo",
  },
  profileImportPreviewPanel: {
    verifiedBackupPreview: "Vista previa del respaldo verificado",
    reviewBeforeReplacingLocalData:
      "Revisa antes de reemplazar los datos locales",
    theBackupPassedStructuralAndIntegrityChecks:
      "Este respaldo pasó las verificaciones de formato e integridad. No se ha reemplazado nada. Al confirmar, también se conserva un respaldo verificado de tu perfil actual, si existe y se puede leer.",
    backupApplication: "Aplicación del respaldo",
    dataRevision: "Revisión de datos",
    automaticHints: "Pistas automáticas",
    activeMatch: "Partida activa",
    earlierFourRatings: "Las cuatro puntuaciones anteriores",
    preservedInBackup: "Conservadas en el respaldo",
    cancelImport: "Cancelar importación",
    replaceLocalPlayerData: "Reemplazar datos locales del jugador",
  },
  profilePersistenceFailurePanel: {
    itIsNotYetSavedLaterState:
      "Este cambio aún no está guardado. Elige Reintentar guardado para volver a intentarlo. Los cambios posteriores están pausados hasta que se guarde correctamente.",
    retryingSave: "Reintentando guardado…",
    retrySave: "Reintentar guardado",
    exportPendingPlayerData: "Exportar datos pendientes del jugador",
    exportUnreadableData: "Exportar datos ilegibles",
  },
  profilePlayExperience: {
    settingsCouldNotBeDisplayed: "No se pudo mostrar la configuración.",
    yourPlayerDataHasNotBeenReset:
      "Tus datos de jugador no se han restablecido. Intenta de nuevo o cierra Configuración.",
    closeSettings: "Cerrar configuración",
    thisScreenCouldNotBeDisplayed: "No se pudo mostrar esta pantalla.",
    yourPlayerDataIsStillHeldIn:
      "Tus datos de jugador siguen en memoria. Intenta de nuevo sin recargar la página o expórtalos.",
    exportPlayerData: "Exportar datos del jugador",
  },
  profileRecoveryPanel: {
    mapachessCouldNotSafelyReadTheCurrent:
      "Mapachess no pudo leer tu guardado local de forma segura. Los datos guardados se conservan, el juego está pausado y no se ha restablecido nada.",
    localDataRecovery: "Recuperación de datos locales",
    yourSaveNeedsAttention: "Tu guardado necesita atención.",
    theDownloadCouldNotBeCreatedYour:
      "No se pudo crear la descarga. Tus datos guardados se conservan sin cambios. Intenta de nuevo o elige otra ubicación de descarga en tu navegador.",
    resetAllLocalPlayerData:
      "¿Restablecer todos los datos locales del jugador?",
    thisReplacesAllLocalPlayerDataIncluding:
      "Esto reemplaza todos los datos locales del jugador, incluida la partida activa, los registros de Historia y Desafío, todas las puntuaciones Elo actuales y sus conteos de partidas con puntuación, las puntuaciones históricas y la configuración. No afecta los archivos de respaldo que ya exportaste.",
    cancel: "Cancelar",
    exportUnreadableData: "Exportar datos ilegibles",
    resetAllLocalPlayerData2: "Restablecer datos locales",
    tryAgain: "Intentar de nuevo",
    restoreLastKnownGoodSave: "Restaurar el último guardado válido conocido",
    reviewFullLocalReset: "Revisar restablecimiento local completo",
  },
  profileSettingsPanel: {
    closeSettings: "Cerrar configuración",
    hintChangesTakeEffectImmediatelyAndBecome:
      "Los cambios de pistas se vuelven tu opción predeterminada y se aplican a la partida actual. Puedes seguir solicitando pistas en tu turno.",
    yourEloRatings: "Tus puntuaciones Elo",
    cancel: "Cancelar",
    exportPlayerData: "Exportar datos del jugador",
    portablePlayerData: "Datos portátiles del jugador",
    dataStaysOnThisDeviceUnlessYou:
      "Tu progreso se queda en este dispositivo. Exporta un respaldo JSON para trasladarlo por tu cuenta. La importación te permite revisar un respaldo antes de reemplazar los datos locales.",
    aboutEloRatings: "Acerca de las puntuaciones Elo",
  },
  webMapachessApplication: {
    theDownloadCouldNotBeCreatedYour:
      "No se pudo crear la descarga. Tus datos locales no cambiaron. Intenta de nuevo o usa otro destino de descarga del navegador.",
    browserStorageDidNotFinishOpeningNothing:
      "El almacenamiento del navegador no terminó de abrirse. No se ha restablecido ni reemplazado nada.",
    localProfile: "Perfil local",
    mapachessCouldNotReadLocalData: "Mapachess no pudo leer los datos locales.",
    tryAgain: "Intentar de nuevo",
    inspectingTheSelectedBackupNothingHasBeen:
      "Revisando el respaldo seleccionado. No se ha reemplazado nada.",
    playerData: "Datos del jugador",
    inspectingBackup: "Revisando respaldo…",
    cancelImport: "Cancelar importación",
    thisBrowserDoesNotCurrentlyProvideThe:
      "Este navegador no ofrece actualmente las API de almacenamiento local e integridad que Mapachess necesita. No se modificaron datos del jugador.",
    localSavesAreUnavailable: "El guardado local no está disponible.",
  },
  error: {
    mapachessCouldNotDisplayThisPage: "Mapachess no pudo mostrar esta página.",
    yourSavedPlayerDataHasNotBeen:
      "Tus datos guardados de jugador no se han restablecido. Intenta abrir la página de nuevo.",
    pageRecovery: "Recuperación de página",
    tryAgain: "Intentar de nuevo",
  },
} as const satisfies MapachessCatalog["interface"]

export default interfaceCopy
