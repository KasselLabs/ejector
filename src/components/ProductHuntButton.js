import React from 'react'

export default function ProductHuntButton () {
  return (
    <a
      className="product-hunt-button"
      href="https://www.producthunt.com/posts/among-us-ejector?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-among-us-ejector"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=272195&theme=dark"
        alt="Among Us Ejector - Create your own Among Us ejection GIF animation | Product Hunt"
        width="240"
      />
      <style jsx>{`
        .product-hunt-button {
          @media (max-width: 400px) {
            display: none;
          }
        }
      `}</style>
    </a>
  )
}
