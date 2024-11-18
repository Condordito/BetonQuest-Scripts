var result = args[0] == null || args[0].trim().length == 0 
  ? "" : PlaceholderAPI.static.setPlaceholders(BukkitPlayer, "%" + args[0] + "%");
result == "" ? args[1] : result