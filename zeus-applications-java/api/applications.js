require('http/v3/rs-data').service()
  .dao(require("zeus-applications-java/data/dao").create().orm)
  .execute();