# dynosearch

A pluggable CDK construct and library to add advanced search capabilities to your exisiting DynamoDB instance all serverless and pay as you go using the finest selection of AWS services.

## Features

- [x] Add full text fuzzy search to an existing DynamoDB
- [x] Automatically index new entries of a table on insert
- [ ] Update entry in index when updated in table
- [x] Supports multiple different storage options:
  - [x] DynamoDB: Write index to separate (or same) table. Great for small indices.
  - [x] S3: Write index to JSON in a bucket. Ideal for small-medium sized indexes.
  - [x] EFS: Write index to JSON to an elastic file system. Perfect for medium-large indecies to maintain speed.
- [ ] CloudWatch Metrics with great insights about the index size and search performance
- [ ] Sort results

## Ideas

- Add option to invalidate lambda caches after x minutes

## Good to know

Of course DynoSearch cannot compete with other well known search engines like ElasticSearch and Meilisearch. DynoSearch is doing a great job to make the best out of the limitations of serverless.

Notice that a search index is always limited in size depending on the lambda memory limit. As of now an index could theoretically be as large as up to 10 GB. Maybe rather 8 GB if you add some buffer for computation.

The way DynoSearch works is really simple, yet effective. It builds the index based on DynamoDB Streams and then writes it to the chosen storage options.
When a search is requested it initially loads the pre-built index from the storage and performs the search in-memory using FlexSearch. It can then return the IDs of found entries that you can use to retrieve the data from the origin DynamoDB table.

### Eventually consistent

An index managed by DynoSearch is never strongly consistent. The amount varies also depending on the choosen storage option.
Because the lambda loads the index into memory and caches it forever a search to that same lambda instance will never know about updates of the underlaying storage option.

### Performance

Cold starts are slower. Because the lambda has to load the index on the first execution it will always take long. But after that it is actually increadibly fast. Find more insights about the warm performance in the FlexSearch docs.

Depending on the storage option and index size a cold start can also be unusabily. This is where everyone has to do their own tweaking.
Here are some guidelines.

#### Small index (1 KB - 5 MB)

Few fields indexed, not much data.

Use DynamoDB as a storage option. It's perfect for smaller indecies. In DynamoDB items can only be up to 400 KB in size. That's why DynoSearch chunks the entire index in multiple parts. This is a slow procedure, because when loading the index a lot of smaller HTTP requests have to be made.

#### Medium index (1 KB - 100 MB)

Few fields indexed, reasonable amount of data.

Use S3 as a storage option. It has overall a good performance. The index does not require to be chunked, so just a single requests downloads the file directly into memory.
It's fine for this size of indecies, but gets slow pretty quickly when the index gets larger.

#### Large index (1 KB - 10 GB)

Many different fields with a lot of text in them and pretty much entries overall.

Use EFS as a storage option. At this point this is the only reasonable option anyways. But this option should always be considered when better performance for also smaller indices is needed.

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
