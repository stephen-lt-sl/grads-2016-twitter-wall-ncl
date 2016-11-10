using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using TwitterWall.Context;
using TwitterWall.Models;

namespace TwitterWall.Repository
{
    public class MediaDBRepository : Repository<MediaUrl>
    {
        public MediaDBRepository() : base()
        {
        }

        public MediaDBRepository(TweetContext ctx) : base(ctx)
        {
        }

        public override MediaUrl Get(long id)
        {
            using (TweetContext context = GetContext())
            {
                return context.MediaUrls.Where(m => m.Id == id).SingleOrDefault();
            }
        }

        public override IEnumerable<MediaUrl> GetAll()
        {
            using (TweetContext context = GetContext())
            {
                return context.MediaUrls;
            }
        }

        public override IEnumerable<MediaUrl> Find(Func<MediaUrl, bool> exp)
        {
            using (TweetContext context = GetContext())
            {
                return context.MediaUrls.Include(m => m.Tweet).Where<MediaUrl>(exp).ToList();
            }
        }

        public override void Add(MediaUrl entity)
        {
            using (TweetContext context = GetContext())
            {
                context.Attach(entity.Tweet);
                context.MediaUrls.Add(entity);
                context.SaveChanges();
            }
        }

        public override void Remove(long id)
        {
            using (TweetContext context = GetContext())
            {
                MediaUrl url = Get(id);
                if (url != null)
                {
                    context.Attach(url);
                    context.MediaUrls.Remove(url);
                    context.SaveChanges();
                }
            }
        }

        public void SetVisibility(long id, bool visibility)
        {
            using (TweetContext context = GetContext())
            {
                MediaUrl url = Get(id);
                if (url != null)
                {
                    context.Attach(url);
                    url.Visible = visibility;
                    context.SaveChanges();
                }
            }
        }

        public void AddFromTweet(Tweetinvi.Models.ITweet tweet, Event ev)
        {
            using (TweetContext context = GetContext())
            {
                Tweet result = context.Tweets.Where(t => t.TweetId == tweet.Id && t.Event.Id == ev.Id).SingleOrDefault();
                if (result != null)
                {
                    List<Tweetinvi.Models.Entities.IMediaEntity> mediaEntities = tweet.Media.Where(e => e.MediaType.Equals("photo")).ToList();
                    foreach (Tweetinvi.Logic.TwitterEntities.MediaEntity entity in mediaEntities)
                    {
                        Add(new MediaUrl(entity.MediaURL, result));
                    }
                }
            }
        }
    }
}