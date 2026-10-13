export const registerSystemSettings = function() {

  // Internal System Migration Version
  game.settings.register("shimmeringreach", "miss_sfx_directory", {
    name: "Miss SFX Directory",
    scope: "world",
    config: true,
    type: String,
    default: "",
	filePicker: true
  });
};
