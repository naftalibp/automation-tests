Test Plan (for Demo)

*** Prerequisites ***

Playwright and extension installed (instructions specify assuming local static file, we won't include isntall/update/delete tests)

*** E2E Sanity ***

Two core functionalities - Block/Allow, and Protect

Block/Allow

1. Navigate to chatgpt.com -> Page loaded successfully
2. Navigate to gemini.google.com -> Page blocked with error message clearly attributed to Prompt Security ("Access Denied" page)

Protect

1. Navigate to chatgpt.com (confirmed as part of protectPolicy) -> enter innocent message -> chatgpt responds
2. Navigate to chatgpt.com -> enter bad message 'password for email bob1@gmail.com is 12345' -> popup shows 'redacted'

*** Client Only Tests ***

Extra prereq - Configure Mock

Run the Block #2 test, to illustrate the block when the backend functions as expected. 
* Potentially more frontend validations like redactions, etc. 


*** Server Only Tests ***

* TBD, out of scope for demo, but shown for illustrative purposes the plan (just the folder and a brief readme is sufficient, to show the intention)