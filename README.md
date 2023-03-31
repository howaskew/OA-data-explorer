# Notes on this Data Quality Explorer take on the OpenActive Data Visualiser 

The Visualiser makes it easy to query OpenActive SessionSeries data directly from RPDE feeds, leveraging the CDN to ensure fast query response times.

This version is not intended for production - it’s a playpen that takes advantage of the crawler and harvester aspects of the visualiser to provide data on which to test the DQ metric calculations and presentation.


The live rpde-visualiser still contains a lot of OpenReferral related code, some of which - e.g. visualising the json and calculating richness - is not working properly


Rather than cutting out everything I don’t need at this stage and building up from a more bare bones app, I have hidden the visual elements such as the filters (either by removing the html <divs> or changing the css e.g. to display: none;)

## Credits

[@OpenReferralUK](https://github.com/OpenReferralUK/) and [@MikeThacker1](https://github.com/MikeThacker1) for providing the tool template which is based on https://tools.openreferraluk.org/ApiQuery/
