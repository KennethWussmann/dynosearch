# dynosearch

A pluggable CDK construct and library to add advanced search capabilities to your exisiting DynamoDB instance all serverless and pay as you go using the finest selection of AWS services.

## Motivation

I really want to like DynamoDB. It's especially nice for personal pet projects where I'm the only user. But eventhough I'm the only user doesn't mean I don't want nice UX. Unfortunately, sometimes it shows in the UX that a backend is using DynamoDB as a data store. For example when you can only search by items using a "starts with" query. That is UX-wise very bad.
Or when you cannot really sort, filter and paginate. Okay, using infinite scrolling works around the pagination issue, but not being able to filter by most of the entries makes a table much less flexible. A table can be a powerful tool to analyse data quickly with a well known UX. But implementing that with DynamoDB is always a real pain. Also infinite scrolling might be good for some applications, but definitely not all.
Of course there are AWS solutions for that issue. Like AWS CloudSearch which lets you directly search through your existing DynamoDB, but costs at least 80€ a month or AWS OpenSearch (hosted ElasticSearch) which costs at least 30€ a month. Very expensive for a pet project.
One could deploy an own ElasticSearch or Meilisearch instance to AWS EC2, App Runner etc., but thats servers you have to care about. I want it to be as managed as possible.

I figured Algolia to be "the best" solution for the above problem. It's actually free for the most pet project needs, easy to implement and if payment is required it's pay-as-you-go as well.
But you have to sync your database manually with the Algolia search index.

Goal is to have a pluggable solution, that one could just deploy on top of their DynamoDB which solves the above issues by not having a running instance of a search engine. Meaning, it should be pay-as-you-go and there is no running instance of some sort that you need to pay for even when not used.

## Ideas

### Searching

There are multiple options.

One common approach is to just but a well known search index into an AWS data storage option and have a lambda that ad-hoc downloads and searches through it.
Which is totally fine and the first thing I'll try.

Another option might be to design a custom search index around the limitations of DynamoDB. I was researching options here already and it seems unlikely to be possible.

### Indexing

Indexing should work automatically. One describes their search index (probably in CDK) and then using DynamoDB Streams the index is automatically synced with the origin table.
The index could then be stored in the very same table like the data (one table design) or maybe one could configure different origin and index tables.
