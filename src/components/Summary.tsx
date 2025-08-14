import React from 'react';
import type { SummaryProps } from '../types';

/**
 * Summary component displays the shopping cart overview
 * This is the first step in the checkout process before payment
 */
const Summary: React.FC<SummaryProps> = ({ onContinue }) => (
 <div id="first-screen">
    <div className="summary-container">
      <div className="container">
        <h4>
          Cart <span className="price" style={{ color: 'black' }}><i className="fa fa-shopping-cart"></i> <b>4</b></span>
        </h4>
        {[
          ['Product 1', '$15'],
          ['Product 2', '$5'],
          ['Product 3', '$8'],
          ['Product 4', '$2'],
        ].map(([name, price]) => (
          <p key={name}>
            <a href="#">{name}</a> <span className="price">{price}</span>
          </p>
        ))}
        <hr />
        <p>Total <span className="price" style={{ color: 'black' }}><b>$10</b></span></p>
      </div>
    </div>
    <button id="continue" className="btn" onClick={e => { e.preventDefault(); onContinue(); }}>
      Continue to checkout
    </button>
  </div>
);

export default Summary;