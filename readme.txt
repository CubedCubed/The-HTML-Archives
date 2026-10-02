THE HTML ARCHIVES
=================

WHAT THIS IS
A Netlify website that hosts a collection of .html files in categories.
Uploaded pages and archive information use Netlify's persistent storage,
so the collection remains available across deployments and devices.


HOW TO USE THE WEBSITE
----------------------
"+ Add Category"     make as many categories as you want (Games, Tools,
                      Art...). They sort alphabetically.
"+ Add HTML File"    pick any .html/.htm file, name it anything, choose a
                      category, save. The button never goes away, so add
                      as many as you want back to back.
"Preview"            launches that HTML in a new tab, fully rendered.
"Move"               move a file to another category via dropdown.
"Rename"             change the display name.
"Delete"             remove a file, or remove a category (its files fall
                      back to "Uncategorized").
"Search"             filter files by name as you type.

Everything added through the website is stored online and shared by visitors.


FILES
-----
public/index.html              the website
netlify/functions/archive.mts the archive API
db/                            the database schema and connection
netlify/database/migrations/  automatically applied database migrations
public/sample-page.html       a sample file to upload
