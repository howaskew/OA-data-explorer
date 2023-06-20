# OpenActive Data Visualiser and Data Quality Explorer

This tools allows users to explore OpenActive data feeds. It is intended for:
- data publishers, to identify data quality issues
- general users, to explore OpenActive data 

The Data Quality metrics focus on key user needs for specific use cases - starting with OpenActive's core 'find and book' use case. They were discussed with users and providers at various meetings of the OpenActive W3C community group during late 2022 / early 2023.

Suggested use:
1. Select a data feed provider
2. Select a data feed type
3. Press Go
4. After the results are shown, you can filter by organiser, location or activity or highlight records that have not met the DQ measure using the sliders.
5. You can view records in various ways: as a table, as raw json fromt the data feeds, as a list, on a map, etc.

THIS TOOLS IS IN BETA - PLEASE RAISE ANY ISSUES HERE OR WITH THE OPENACTIVE TEAM

# Background

The original Visualiser made it easy to query OpenActive SessionSeries data directly from RPDE feeds, leveraging the CDN to ensure fast query response times.

This Data Quality Explorer built on the crawler and harvester aspects of the visualiser to provide data to test the DQ metric calculations and visualisation. However, the immediacy of the data quality feedback and the visualisations proved useful / positive so we made the tool a little more robust and available for data publishers.


## Credits

[@OpenReferralUK](https://github.com/OpenReferralUK/) and [@MikeThacker1](https://github.com/MikeThacker1) provided the tool template which is based on https://tools.openreferraluk.org/ApiQuery/

[@nickevansuk](https://github.com/nickevansuk/) created the original visualiser from the template.
